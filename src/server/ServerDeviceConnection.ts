// @ts-ignore
import ADB from 'adbkit';
// @ts-ignore
import { EventEmitter } from 'events';
import * as path from 'path';
import { Stream } from 'stream';
import { Socket } from 'net';

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(__dirname, '../public');
const FILE_NAME = 'scrcpy-server.jar';
const ARGS = '/ com.genymobile.scrcpy.Server 0 8000000 false - false true web >/dev/null&';

const GET_SHELL_PROCESSES = 'find /proc -type d -maxdepth 1 -user shell -group shell 2>/dev/null';
const CHECK_CMDLINE = 'test -f "$a/cmdline" && grep -av find "$a/cmdline" |grep -sa scrcpy 2>&1 > /dev/null && echo $a |cut -d "/" -f 3;';
const CMD = 'for a in `' + GET_SHELL_PROCESSES + '`; do ' + CHECK_CMDLINE + ' done; exit 0';

// tslint:disable-next-line:no-any
type Callback = (err: Error | null, result?: any) => void;

interface PushTransfer extends EventEmitter {}
interface AdbKitTracker extends EventEmitter {
    deviceList: AdbKitDevice[];
    deviceMap: Record<string, AdbKitDevice>;
}

interface AdbKitDevice {
    id: string;
    type: string;
}

interface AdbKitClient {
    listDevices(): Promise<AdbKitDevice[]>;
    trackDevices(): Promise<AdbKitTracker>;
    getProperties(serial: string): Promise<Record<string, string>>;
    push(serial: string, contents: string | Stream, path: string, mode?: number, callback?: Callback): Promise<PushTransfer>;
    shell(serial: string, command: string, callback?: Callback): Promise<Socket>;
    waitBootComplete(serial: string): Promise<string>;
}

interface AdbKitChangesSet {
    added: AdbKitDevice[];
    removed: AdbKitDevice[];
    changed: AdbKitDevice[];
}

export interface Device {
    udid: string;
    state: string;
    ip: string;
    model: string;
    manufacturer: string;
    pid: number;
}

export class ServerDeviceConnection extends EventEmitter {
    public static readonly UPDATE_EVENT: string = 'update';
    private static instance: ServerDeviceConnection;
    private static cacheTime: number = 15000;
    private lastUpdate: number = 0;
    private cache: Device[] = [];
    private deviceMap: Map<string, Device> = new Map();
    private clientMap: Map<string, AdbKitClient> = new Map();
    private client: AdbKitClient = ADB.createClient();
    private tracker?: AdbKitTracker;
    private initialized: boolean = false;
    public static async getInstance(): Promise<ServerDeviceConnection> {
        if (!this.instance) {
            this.instance = new ServerDeviceConnection();
        }
        return this.instance;
    }
    constructor() {
        super();
    }

    public async init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        await this.initTracker();
        this.initialized = true;
    }

    private async initTracker(): Promise<AdbKitTracker> {
        if (this.tracker) {
            return this.tracker;
        }
        const tracker = this.tracker = await this.client.trackDevices();
        if (tracker.deviceList && tracker.deviceList.length) {
            this.cache = await this.mapDevicesToDescriptors(tracker.deviceList);
        }
        tracker.on('changeSet', async (changes: AdbKitChangesSet) => {
            if (changes.added.length) {
                for (const device of changes.added) {
                    const descriptor = await this.getDescriptor(device);
                    this.deviceMap.set(device.id, descriptor);
                }
            }
            if (changes.removed.length) {
                for (const device of changes.removed) {
                    const udid = device.id;
                    if (this.deviceMap.has(udid)) {
                        this.deviceMap.delete(udid);
                    }
                    if (this.clientMap.has(device.id)) {
                        this.clientMap.delete(device.id);
                    }
                }
            }
            if (changes.changed.length) {
                for (const device of changes.changed) {
                    const udid = device.id;
                    const descriptor = await this.getDescriptor(device);
                    this.deviceMap.set(udid, descriptor);
                    if (this.clientMap.has(udid)) {
                        this.clientMap.delete(udid);
                    }
                }
            }
            this.cache = Array.from(this.deviceMap.values());
            this.lastUpdate = Date.now();
            this.emit(ServerDeviceConnection.UPDATE_EVENT, this.cache);
        });
        return tracker;
    }
    private async mapDevicesToDescriptors(list: AdbKitDevice[]): Promise<Device[]> {
        const all = await Promise.all(list.map(device => this.getDescriptor(device)));
        list.forEach((device: AdbKitDevice, idx: number) => {this.deviceMap.set(device.id, all[idx]);});
        return all;
    }

    private getOrCreateClient(udid: string): AdbKitClient {
        let client: AdbKitClient | undefined;
        if (this.clientMap.has(udid)) {
            client = this.clientMap.get(udid);
        }
        if (!client) {
            client = ADB.createClient() as AdbKitClient;
            this.clientMap.set(udid, client);
        }
        return client;
    }

    private async getDescriptor(device: AdbKitDevice): Promise<Device> {
        const {id: udid, type: state} = device;
        if (state === 'offline') {
            return {
                pid: -1,
                ip: '0.0.0.0',
                manufacturer: '',
                model: '',
                state,
                udid
            };
        }
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const props = await client.getProperties(udid);
        const wifi = props['wifi.interface'];
        const descriptor: Device = {
            pid: -1,
            ip: '127.0.0.1',
            manufacturer: props['ro.product.manufacturer'],
            model: props['ro.product.model'],
            state,
            udid
        };
        try {
            const stream = await client.shell(udid, `ip route |grep ${wifi} |grep -v default`);
            const buffer = await ADB.util.readAll(stream);
            const temp = buffer.toString().split(' ').filter((i: string) => !!i);
            descriptor.ip = temp[8];
            let pid = await this.getPID(device);
            let count = 0;
            while (isNaN(pid) && count < 5) {
                await this.startServer(device);
                pid = await this.getPID(device);
                count++;
            }
            if (isNaN(pid)) {
                console.error(`[${udid}] error: failed to start server`);
                descriptor.pid = -1;
            } else {
                descriptor.pid = pid;
            }
        } catch (e) {
            console.error(`[${udid}] error: ${e.message}`);
        }
        return descriptor;
    }

    private async getPID(device: AdbKitDevice): Promise<number> {
        const {id: udid} = device;
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const stream = await client.shell(udid, CMD);
        const buffer = await ADB.util.readAll(stream);
        const shellProcessesArray = buffer.toString().split('\n').filter((pid: string) => pid.trim().length);
        if (!shellProcessesArray.length) {
            return NaN;
        }
        return parseInt(shellProcessesArray[0], 10);
    }

    private async startServer(device: AdbKitDevice): Promise<void> {
        const {id: udid} = device;
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        await client.push(udid, src, dst);
        const command = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS}`;
        const result = await Promise.race([
            new Promise(resolve => {
                setTimeout(resolve, 1000);
            }),
            client.shell(udid, command).then(ADB.util.readAll).catch(e => {
                console.error(`[${udid}] error: ${e.message}`);
            })
        ]);
        if (result) {
            console.info(`[${udid}] Result: ${result}`);
        }
    }

    public async getDevices(): Promise<Device[]> {
        if (Date.now() - this.lastUpdate > ServerDeviceConnection.cacheTime) {
            if (this.tracker) {
                const deviceList = this.tracker.deviceList || [];
                this.cache = await this.mapDevicesToDescriptors(deviceList);
                this.lastUpdate = Date.now();
            }
        }
        return this.cache;
    }
}
