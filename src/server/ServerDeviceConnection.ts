// @ts-ignore
import ADB from 'adbkit';
// @ts-ignore
import { EventEmitter } from 'events';
import * as path from 'path';
import { Device } from '../common/Device';
import { AdbKitChangesSet, AdbKitClient, AdbKitDevice, AdbKitTracker, PushTransfer } from '../common/AdbKit';
import { SERVER_PACKAGE, SERVER_PORT, SERVER_VERSION } from './Constants';

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(__dirname, '../public');
const FILE_NAME = 'scrcpy-server.jar';
const ARGS = `/ ${SERVER_PACKAGE} ${SERVER_VERSION} 0 8000000 60 -1 false - false false 0 web ${SERVER_PORT} > ${TEMP_PATH}OUTPUT&`;

const GET_SHELL_PROCESSES = 'find /proc -type d -maxdepth 1 -user $UID -group $GID 2>/dev/null';
const CHECK_CMDLINE = `test -f "$a/cmdline" && grep -av find "$a/cmdline" |grep -sa ${SERVER_PACKAGE} |grep ${SERVER_VERSION} 2>&1 > /dev/null && echo $a |cut -d "/" -f 3;`;
const CMD = 'UID=`id -nu`; GID=`id -ng`; for a in `' + GET_SHELL_PROCESSES + '`; do ' + CHECK_CMDLINE + ' done; exit 0';

export class ServerDeviceConnection extends EventEmitter {
    public static readonly UPDATE_EVENT: string = 'update';
    private static instance: ServerDeviceConnection;
    private cache: Device[] = [];
    private deviceMap: Map<string, Device> = new Map();
    private clientMap: Map<string, AdbKitClient> = new Map();
    private client: AdbKitClient = ADB.createClient();
    private tracker?: AdbKitTracker;
    private initialized: boolean = false;
    public static getInstance(): ServerDeviceConnection {
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
                'build.version.release': '',
                'build.version.sdk': '',
                'ro.product.cpu.abi': '',
                'product.manufacturer': '',
                'product.model': '',
                pid: -1,
                ip: '0.0.0.0',
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
            'ro.product.cpu.abi': props['ro.product.cpu.abi'],
            'product.manufacturer': props['ro.product.manufacturer'],
            'product.model': props['ro.product.model'],
            'build.version.release': props['ro.build.version.release'],
            'build.version.sdk': props['ro.build.version.sdk'],
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
            if (isNaN(pid)) {
                await this.copyServer(device);
            }
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

    private async copyServer(device: AdbKitDevice): Promise<PushTransfer> {
        const {id: udid} = device;
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid); const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        return client.push(udid, src, dst);
    }

    private async startServer(device: AdbKitDevice): Promise<void> {
        const {id: udid} = device;
        const client = this.getOrCreateClient(udid);
        const command = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS}`;
        const result = await Promise.race([
            new Promise(resolve => {
                setTimeout(resolve, 2000);
            }),
            client.shell(udid, command).then(ADB.util.readAll).catch(e => {
                console.error(`[${udid}] error: ${e.message}`);
            })
        ]);
        if (result) {
            console.info(`[${udid}] Result: ${result}`);
        }
    }

    public getDevices(): Device[] {
        this.initTracker()
            .then(tracker => {
                if (tracker && tracker.deviceList && tracker.deviceList.length) {
                    return this.mapDevicesToDescriptors(tracker.deviceList);
                }
                return [] as Device[];
            })
            .then(list => {
                this.cache = list;
                this.emit(ServerDeviceConnection.UPDATE_EVENT, this.cache);
            });
        return this.cache;
    }
}
