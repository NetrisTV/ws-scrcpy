import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { TypedEmitter } from '../../../common/TypedEmitter';
import { Message } from '../../../types/Message';
import * as portfinder from 'portfinder';
import { Server, XCUITestDriver } from '../../../types/WdaServer';
import * as XCUITest from 'appium-xcuitest-driver';
import { DEVICE_CONNECTIONS_FACTORY } from 'appium-xcuitest-driver/build/lib/device-connections-factory';

const MJPEG_SERVER_PORT = 9100;

export interface WDARunnerEvents {
    started: boolean;
    error: Error;
    response: Message;
}

export class WDARunner extends TypedEmitter<WDARunnerEvents> {
    protected static TAG = 'WDARunner';
    private static instances: Map<string, WDARunner> = new Map();
    public static SHUTDOWN_TIMEOUT = 15000;
    private static servers: Map<string, Server> = new Map();
    private static cachedScreenInfo: Map<string, any> = new Map();
    public static getInstance(udid: string): WDARunner {
        let instance = this.instances.get(udid);
        if (!instance) {
            instance = new WDARunner(udid);
            this.instances.set(udid, instance);
            instance.start();
        }
        instance.lock();
        return instance;
    }
    public static async getServer(udid: string): Promise<Server> {
        let server = this.servers.get(udid);
        if (!server) {
            const port = await portfinder.getPortPromise();
            server = await XCUITest.startServer(port, '127.0.0.1');
            this.servers.set(udid, server);
        }
        return server;
    }
    public static async getScreenInfo(udid: string, driver: XCUITestDriver): Promise<any> {
        const cached = this.cachedScreenInfo.get(udid);
        if (cached) {
            return cached;
        }
        const el = await driver.findElement('xpath', '//XCUIElementTypeApplication');
        const size = await driver.getSize(el);
        this.cachedScreenInfo.set(udid, size);
        return size;
    }

    protected name: string;
    protected started = false;
    public session: any;
    private server?: Server;
    private mjpegServerPort = 0;
    private wdaLocalPort = 0;
    private holders = 0;
    protected releaseTimeoutId?: NodeJS.Timeout;

    constructor(private readonly udid: string) {
        super();
        this.name = `[${WDARunner.TAG}][udid: ${this.udid}]`;
    }

    protected lock(): void {
        if (this.releaseTimeoutId) {
            clearTimeout(this.releaseTimeoutId);
        }
        this.holders++;
    }

    protected unlock(): void {
        this.holders--;
        if (this.holders > 0) {
            return;
        }
        this.releaseTimeoutId = setTimeout(async () => {
            WDARunner.servers.delete(this.udid);
            WDARunner.instances.delete(this.udid);
            if (this.server) {
                if (this.server.driver) {
                    await this.server.driver.deleteSession();
                }
                this.server.close();
                delete this.server;
            }
        }, WDARunner.SHUTDOWN_TIMEOUT);
    }

    public get mjpegPort(): number {
        return this.mjpegServerPort;
    }

    public async request(command: ControlCenterCommand): Promise<any> {
        const driver = this.server?.driver;
        if (!driver) {
            return;
        }

        const method = command.getMethod();
        const args = command.getArgs();
        switch (method) {
            case 'getScreen':
                return WDARunner.getScreenInfo(this.udid, driver);
            case 'click':
                return driver.performTouch([{ action: 'tap', options: { x: args.x, y: args.y } }]);
            case 'pressButton':
                return driver.mobilePressButton({ name: args.name });
            case 'scroll':
                const { from, to } = args;
                return driver.performTouch([
                    { action: 'press', options: { x: from.x, y: from.y } },
                    { action: 'wait', options: { ms: 500 } },
                    { action: 'moveTo', options: { x: to.x, y: to.y } },
                    { action: 'release', options: {} },
                ]);
            default:
                return `Unknown command: ${method}`;
        }
    }

    public async start(): Promise<void> {
        this.server = await WDARunner.getServer(this.udid);
        try {
            const remoteMjpegServerPort = MJPEG_SERVER_PORT;
            const ports = await Promise.all([portfinder.getPortPromise(), portfinder.getPortPromise()]);
            this.wdaLocalPort = ports[0];
            this.mjpegServerPort = ports[1];
            this.session = await this.server.driver.createSession({
                platformName: 'iOS',
                deviceName: 'my iphone',
                udid: this.udid,
                wdaLocalPort: this.wdaLocalPort,
                usePrebuiltWDA: true,
                mjpegServerPort: remoteMjpegServerPort,
            });
            /// #if WDA_RUN_MJPEG_SERVER
            await DEVICE_CONNECTIONS_FACTORY.requestConnection(this.udid, this.mjpegServerPort, {
                usePortForwarding: true,
                devicePort: remoteMjpegServerPort,
            });
            /// #endif
            this.started = true;
            this.emit('started', true);
        } catch (e) {
            this.emit('error', e);
        }
    }

    public isStarted(): boolean {
        return this.started;
    }

    public release(): void {
        this.unlock();
    }
}
