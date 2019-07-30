// @ts-ignore
import ADB from 'appium-adb';
// @ts-ignore
import { logger } from 'appium-support';
import { EventEmitter } from 'events';
import Timeout = NodeJS.Timeout;

// const TEMP_PATH = '/data/local/tmp/';
// const FILE_DIR = process.cwd();
// const FILE_NAME = 'scrcpy-server.jar';
// const ARGS = '/ com.genymobile.scrcpy.Server 0 8000000 false - false true web&';

export interface IDevice {
    udid: string;
    state: string;
    ip: string;
    model: string;
    manufacturer: string;
}

export class ServerDeviceConnection extends EventEmitter {
    private static UPDATE_EVENT: string = 'update';
    private static instance: ServerDeviceConnection;
    private static cacheTime: number = 15000;
    private cache?: IDevice[];
    private adb: ADB;
    private adbPromise: Promise<ADB>;
    private updatePromise: Promise<IDevice[]>;
    private checkTimeout?: Timeout;
    private adbList: Record<string, ADB> = {};
    public static async getInstance(): Promise<ServerDeviceConnection> {
        if (!this.instance) {
            this.instance = new ServerDeviceConnection(logger.getLogger('ServerDeviceConnection'));
        }
        return this.instance;
    }
    constructor(private readonly log: logger) {
        super();
        this.adbPromise = ADB.createADB();
        this.updatePromise = this.getDevices_();
    }
    private async getAdb(): ADB {
        if (this.adbPromise) {
            this.adb = await this.adbPromise;
            delete this.adbPromise;
        }
        return this.adb;
    }
    private async getOrCreateAdb(udid: string): Promise<ADB> {
        let adb = this.adbList[udid];
        if (!adb) {
            adb = await ADB.createADB();
            adb.setDeviceId(udid);
            this.adbList[udid] = adb;
        }
        return adb;
    }
    private async getDevices_(): Promise<IDevice[]> {
        const adb = await this.getAdb();
        return adb.getConnectedDevices();
    }
    public async getDevices(force?: boolean): Promise<IDevice[]> {
        if (this.cache && !force) {
            return this.cache;
        }
        if (!this.updatePromise) {
            this.updatePromise = this.getDevices_();
        }
        const list = await this.updatePromise;
        delete this.updatePromise;
        const all = list.map(async (item: IDevice) => {
            const adb: ADB = await this.getOrCreateAdb(item.udid);
            let ip = '';
            let model = '';
            let manufacturer = '';
            try {
                const result = await adb.shell('ip route|grep wlan0|grep -v default');
                const temp = result.split(' ').filter((i: string) => !!i);
                ip = temp[8];
                model = (await adb.getModel()) || 'Model';
                manufacturer = (await adb.getManufacturer()) || 'Manufacturer';
                // const pid: number[] = await adb.getPIDsByName('scrcpy');
                // this.log.info(`PIDs: ${JSON.stringify(pid)}`);
                // if (!pid || !pid.length) {
                //     await adb.push(path.join(FILE_DIR, FILE_NAME), TEMP_PATH);
                //     const exit = await adb.shell(`CLASSPATH=${TEMP_PATH}${FILE_NAME} app_process ${ARGS}`);
                //     console.log(`exit code: ${exit}`);
                // }
            } catch (e) {
                this.log.error(e);
            }
            item.ip = ip;
            item.model = model;
            item.manufacturer = manufacturer;
        });
        await Promise.all(all);
        return this.cache = list;
    }
    private check(): void {
        if (this.listenerCount(ServerDeviceConnection.UPDATE_EVENT)) {
            if (this.checkTimeout) {
                return;
            }
            this.checkTimeout = setTimeout(async () => {
                const cache = this.cache;
                const list = await this.getDevices(true);
                if (JSON.stringify(list) !== JSON.stringify(cache)) {
                    this.emit(ServerDeviceConnection.UPDATE_EVENT, this.cache);
                }
                delete this.checkTimeout;
                this.check();
            }, ServerDeviceConnection.cacheTime);
        } else {
            if (!this.checkTimeout) {
                return;
            }
            clearTimeout(this.checkTimeout);
            delete this.checkTimeout;
        }
    }
    /* tslint:disable: no-any */
    public on(event: string | symbol, listener: (...args: any[]) => void): this {
        super.on(event, listener);
        this.check();
        return this;
    }
    public once(event: string | symbol, listener: (...args: any[]) => void): this {
        super.once(event, listener);
        this.check();
        return this;
    }
    public addListener(event: string | symbol, listener: (...args: any[]) => void): this {
        super.addListener(event, listener);
        this.check();
        return this;
    }

    public prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
        super.prependListener(event, listener);
        this.check();
        return this;
    }

    public prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
        super.prependOnceListener(event, listener);
        this.check();
        return this;
    }

    public removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
        super.removeListener(event, listener);
        this.check();
        return this;
    }

    public off(event: string | symbol, listener: (...args: any[]) => void): this {
        if (typeof super.off === 'function') {
            super.off(event, listener);
        } else {
            super.removeListener(event, listener);
        }
        this.check();
        return this;
    }

    public removeAllListeners(event?: string | symbol): this {
        super.removeAllListeners(event);
        this.check();
        return this;
    }
    /* tslint:enable*/
}
