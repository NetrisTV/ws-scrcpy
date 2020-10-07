import '../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../vendor/Genymobile/scrcpy/LICENSE.txt';

import ADB, { AdbKitChangesSet, AdbKitClient, AdbKitDevice, AdbKitTracker, PushTransfer } from 'adbkit';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as path from 'path';
import { DeviceDescriptor } from './DeviceDescriptor';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_VERSION } from './Constants';
import DroidDeviceDescriptor from '../common/DroidDeviceDescriptor';
import Timeout = NodeJS.Timeout;
import { NetInterface } from '../common/NetInterface';

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(__dirname, 'vendor/Genymobile/scrcpy');
const FILE_NAME = 'scrcpy-server.jar';

const GET_SHELL_PROCESSES = 'for DIR in /proc/*; do [ -d "$DIR" ] && echo $DIR;  done';
const CHECK_CMDLINE = `[ -f "$a/cmdline" ] && grep -av find "$a/cmdline" |grep -sae '^app_process.*${SERVER_PACKAGE}' |grep ${SERVER_VERSION} 2>&1 > /dev/null && echo $a;`;
const CMD = 'for a in `' + GET_SHELL_PROCESSES + '`; do ' + CHECK_CMDLINE + ' done; exit 0';

export class ServerDeviceConnection extends EventEmitter {
    public static readonly UPDATE_EVENT: string = 'update';
    private static instance: ServerDeviceConnection;
    private pendingUpdate = false;
    private cache: DroidDeviceDescriptor[] = [];
    private deviceDescriptors: Map<string, DeviceDescriptor> = new Map();
    private clientMap: Map<string, AdbKitClient> = new Map();
    private client: AdbKitClient = ADB.createClient();
    private tracker?: AdbKitTracker;
    private initialized = false;
    private restartTimeoutId?: Timeout;
    private throttleTimeoutId?: Timeout;
    private lastEmit = 0;
    private waitAfterError = 1000;
    private ignoredDevices: Set<string> = new Set();
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
        const tracker = (this.tracker = await this.client.trackDevices());
        tracker.on('changeSet', async (changes: AdbKitChangesSet) => {
            if (changes.added.length) {
                for (const device of changes.added) {
                    const descriptor = await this.getDescriptor(device);
                    this.deviceDescriptors.set(device.id, descriptor);
                }
            }
            if (changes.removed.length) {
                for (const device of changes.removed) {
                    const udid = device.id;
                    if (this.deviceDescriptors.has(udid)) {
                        this.deviceDescriptors.delete(udid);
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
                    this.deviceDescriptors.set(udid, descriptor);
                    if (this.clientMap.has(udid)) {
                        this.clientMap.delete(udid);
                    }
                }
            }
            this.populateCache();
            this.emitUpdate();
        });
        tracker.on('end', this.restartTracker);
        tracker.on('error', this.restartTracker);
        return tracker;
    }

    private restartTracker = (): void => {
        if (this.restartTimeoutId) {
            return;
        }
        console.log(`Device tracker is down. Will try to restart in ${this.waitAfterError}ms`);
        this.restartTimeoutId = setTimeout(() => {
            delete this.restartTimeoutId;
            delete this.tracker;
            this.waitAfterError *= 1.2;
            this.pendingUpdate = false;
            this.updateDeviceList();
        }, this.waitAfterError);
    };

    private emitUpdate(): void {
        const THROTTLE = 300;
        const now = Date.now();
        const time = now - this.lastEmit;
        if (time > THROTTLE) {
            this.lastEmit = now;
            this.emit(ServerDeviceConnection.UPDATE_EVENT, this.cache);
            return;
        }
        if (!this.throttleTimeoutId) {
            this.throttleTimeoutId = setTimeout(() => {
                delete this.throttleTimeoutId;
                this.emitUpdate();
            }, THROTTLE - time);
        }
    }

    private populateCache(): void {
        this.cache = Array.from(this.deviceDescriptors.values()).map((d) => {
            return d.toJSON();
        });
    }

    private updateDescriptor(fields: DroidDeviceDescriptor): DeviceDescriptor {
        const { udid } = fields;
        let descriptor = this.deviceDescriptors.get(udid);
        if (!descriptor || (descriptor && !descriptor.equals(fields))) {
            descriptor = new DeviceDescriptor(fields);
            this.deviceDescriptors.set(udid, descriptor);
            this.populateCache();
            this.emitUpdate();
        }
        return descriptor;
    }

    private async mapDevicesToDescriptors(list: AdbKitDevice[]): Promise<DeviceDescriptor[]> {
        const all = await Promise.all(list.map((device) => this.getDescriptor(device)));
        list.forEach((device: AdbKitDevice, idx: number) => {
            this.deviceDescriptors.set(device.id, all[idx]);
        });
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

    private async getNetInterfaces(device: AdbKitDevice): Promise<NetInterface[]> {
        const { id: udid } = device;
        const client = this.getOrCreateClient(udid);
        const list: NetInterface[] = [];
        const stream = await client.shell(udid, `ip -4 -f inet -o a | grep 'scope global'`);
        const buffer = await ADB.util.readAll(stream);
        const lines = buffer
            .toString()
            .split('\n')
            .filter((i: string) => !!i);
        lines.forEach((value) => {
            const temp = value.split(' ').filter((i: string) => !!i);
            const name = temp[1];
            const ipAndMask = temp[3];
            const ipv4 = ipAndMask.split('/')[0];
            list.push({ name, ipv4 });
        });
        return list;
    }

    private async getDescriptor(device: AdbKitDevice): Promise<DeviceDescriptor> {
        const { id: udid, type: state } = device;
        if (state === 'offline') {
            const dummy: DroidDeviceDescriptor = {
                'build.version.release': '',
                'build.version.sdk': '',
                'ro.product.cpu.abi': '',
                'product.manufacturer': '',
                'product.model': '',
                'wifi.interface': '',
                interfaces: [],
                pid: -1,
                state,
                udid,
            };
            this.updateDescriptor(dummy);
            return new DeviceDescriptor(dummy);
        }
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const props = await client.getProperties(udid);
        const stored = this.deviceDescriptors.get(udid);
        const fields: DroidDeviceDescriptor = {
            pid: stored ? stored.pid : -1,
            interfaces: stored ? stored.interfaces : [],
            'ro.product.cpu.abi': props['ro.product.cpu.abi'],
            'product.manufacturer': props['ro.product.manufacturer'],
            'product.model': props['ro.product.model'],
            'build.version.release': props['ro.build.version.release'],
            'build.version.sdk': props['ro.build.version.sdk'],
            'wifi.interface': props['wifi.interface'],
            state,
            udid,
        };
        this.updateDescriptor(fields);
        try {
            let pid = await this.getPID(udid);
            const isIgnored = this.ignoredDevices.has(udid);
            if (!isIgnored) {
                let count = 0;
                if (isNaN(pid)) {
                    await this.copyServer(device);
                }
                while (isNaN(pid) && count < 5) {
                    this.spawnServer(udid);
                    pid = await this.getPID(udid);
                    count++;
                }
            }
            if (isNaN(pid)) {
                if (!isIgnored) {
                    console.error(`[${udid}] error: failed to start server`);
                }
                fields.pid = -1;
            } else {
                fields.pid = pid;
            }
        } catch (e) {
            console.error(`[${udid}] error: ${e.message}`);
        }

        this.updateDescriptor(fields);
        fields.interfaces = await this.getNetInterfaces(device);
        return this.updateDescriptor(fields);
    }

    private async getPID(udid: string): Promise<number> {
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const stream = await client.shell(udid, CMD);
        const buffer = await ADB.util.readAll(stream);
        const shellProcessesArray = buffer
            .toString()
            .split('\n')
            .filter((str: string) => str.trim().length)
            .map((str: string) => {
                const temp = str.split('/');
                if (temp.length === 3) {
                    return temp[2];
                }
                return str;
            });
        if (!shellProcessesArray.length) {
            return NaN;
        }
        return parseInt(shellProcessesArray[0], 10);
    }

    private async copyServer(device: AdbKitDevice): Promise<PushTransfer> {
        const { id: udid } = device;
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        return client.push(udid, src, dst);
    }

    private runShellCommandAndUpdateList(udid: string, command: string): void {
        const adb = spawn('adb', ['-s', `${udid}`, 'shell', command], { stdio: ['ignore', 'pipe', 'pipe'] });

        adb.stdout.on('data', (data) => {
            console.log(`[${udid}] stdout: ${data.toString().replace(/\n$/, '')}`);
        });

        adb.stderr.on('data', (data) => {
            console.error(`[${udid}] stderr: ${data}`);
        });

        adb.on('error', (e: Error) => {
            console.error(`[${udid}] failed to spawn adb process ${e.message}`);
            console.error(e.stack);
        });

        adb.on('close', (code) => {
            console.log(`[${udid}] adb process exited with code ${code}`);
            this.updateDeviceList();
        });
    }

    private spawnServer(udid: string): void {
        const command = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;
        this.runShellCommandAndUpdateList(udid, command);
    }

    private updateDeviceList(): void {
        if (this.pendingUpdate) {
            return;
        }
        this.pendingUpdate = true;
        const anyway = () => {
            this.pendingUpdate = false;
        };
        this.initTracker()
            .then((tracker) => {
                if (tracker && tracker.deviceList && tracker.deviceList.length) {
                    return this.mapDevicesToDescriptors(tracker.deviceList);
                }
                return [] as DeviceDescriptor[];
            })
            .then(anyway, anyway);
    }

    public getDevices(): DroidDeviceDescriptor[] {
        this.updateDeviceList();
        return this.cache;
    }

    public killProcess({ udid, pid }: { udid: string; pid: number }): void {
        const command = `kill ${pid}`;
        this.runShellCommandAndUpdateList(udid, command);
    }

    public async killServer(udid: string): Promise<void> {
        const pid = await this.getPID(udid);
        if (!isNaN(pid) && pid > 0) {
            this.ignoredDevices.add(udid);
            this.killProcess({ udid, pid });
        }
    }

    public async startServer(udid: string): Promise<void> {
        const pid = await this.getPID(udid);
        if (isNaN(pid) || pid <= 0) {
            this.ignoredDevices.delete(udid);
            this.spawnServer(udid);
        }
    }
}
