import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { TypedEmitter } from '../../../app/TypedEmitter';
import { Message } from '../../../types/Message';
import * as portfinder from 'portfinder';
import { Server, XCUITestDriver } from '../../../types/WdaServer';

export interface WDARunnerEvents {
    started: boolean;
    error: Error;
    response: Message;
}

export class WDARunner extends TypedEmitter<WDARunnerEvents> {
    protected static TAG = 'WDARunner';
    private static instances: Map<string, WDARunner> = new Map();
    private static servers: Map<string, Server> = new Map();
    private static cachedScreenInfo: Map<string, any> = new Map();
    public static getInstance(udid: string): WDARunner {
        let instance = this.instances.get(udid);
        if (!instance) {
            instance = new WDARunner(udid);
            this.instances.set(udid, instance);
            instance.start();
        } else if (instance.releaseTimeoutId) {
            clearTimeout(instance.releaseTimeoutId);
        }
        instance.holders++;
        return instance;
    }
    public static async getServer(udid: string): Promise<Server> {
        let server = this.servers.get(udid);
        if (!server) {
            const port = await portfinder.getPortPromise();
            const XCUITest = await import('appium-xcuitest-driver');
            server = await XCUITest.startServer(port, '127.0.0.1');
        }
        return server;
    }
    public static async getScreenInfo(udid: string, driver: XCUITestDriver): Promise<any> {
        const cached = this.cachedScreenInfo.get(udid);
        if (cached) {
            return cached;
        }
        const info = await driver.getScreenInfo();
        this.cachedScreenInfo.set(udid, info);
        return info;
    }

    protected name: string;
    protected started = false;
    public session: any;
    private server?: Server;
    private holders = 0;
    protected releaseTimeoutId?: NodeJS.Timeout;

    constructor(private readonly udid: string) {
        super();
        this.name = `[${WDARunner.TAG}][udid: ${this.udid}]`;
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
            const port = await portfinder.getPortPromise();
            this.session = await this.server.driver.createSession({
                platformName: 'iOS',
                deviceName: 'my iphone',
                udid: this.udid,
                wdaLocalPort: port,
                usePrebuiltWDA: true,
            });
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
        this.holders--;
        if (this.holders > 0) {
            return;
        }
        const TIME = 15000;
        this.releaseTimeoutId = setTimeout(async () => {
            WDARunner.servers.delete(this.udid);
            WDARunner.instances.delete(this.udid);
            if (this.server) {
                if (this.server.driver) {
                    await this.server.driver.deleteSession();
                }
                this.server.close();
            }
        }, TIME);
    }
}
