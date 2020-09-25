import '../public/scrcpy-server.jar.asset';

import ADB, { AdbKitChangesSet, AdbKitClient, AdbKitDevice, AdbKitTracker, PushTransfer } from 'adbkit';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import * as path from 'path';
import { DeviceDescriptor } from './DeviceDescriptor';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_VERSION } from './Constants';
import DroidDeviceDescriptor from '../common/DroidDeviceDescriptor';
import Timeout = NodeJS.Timeout;

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = __dirname;
const FILE_NAME = 'scrcpy-server.jar';

const GET_SHELL_PROCESSES = 'for DIR in /proc/*; do [ -d "$DIR" ] && echo $DIR;  done';
const CHECK_CMDLINE = `[ -f "$a/cmdline" ] && grep -av find "$a/cmdline" |grep -sae '^app_process.*${SERVER_PACKAGE}' |grep ${SERVER_VERSION} 2>&1 > /dev/null && echo $a;`;
const CMD = 'for a in `' + GET_SHELL_PROCESSES + '`; do ' + CHECK_CMDLINE + ' done; exit 0';

const LABEL = {
    UNKNOWN: '[unknown]',
    DETECTION: '[detection...]',
    FAILED_TO_GET: '[failed to get]',
    RUNNING: '[running]',
};

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
        if (!descriptor || !descriptor.equals(fields)) {
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

    private async getDescriptor(device: AdbKitDevice): Promise<DeviceDescriptor> {
        const { id: udid, type: state } = device;
        if (state === 'offline') {
            const dummy = {
                'build.version.release': '',
                'build.version.sdk': '',
                'ro.product.cpu.abi': '',
                'product.manufacturer': '',
                'product.model': '',
                'wifi.interface': '',
                pid: -1,
                ip: LABEL.UNKNOWN,
                state,
                udid,
            };
            this.updateDescriptor(dummy);
            return new DeviceDescriptor(dummy);
        }
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const props = await client.getProperties(udid);
        const wifi = props['wifi.interface'];
        const stored = this.deviceDescriptors.get(udid);
        const fields: DroidDeviceDescriptor = {
            pid: stored ? stored.pid : -1,
            ip: stored ? stored.ip : LABEL.DETECTION,
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
            let pid = await this.getPID(device);
            let count = 0;
            if (isNaN(pid)) {
                await this.copyServer(device);
            }
            while (isNaN(pid) && count < 5) {
                this.spawnServer(device);
                pid = await this.getPID(device);
                count++;
            }
            if (isNaN(pid)) {
                console.error(`[${udid}] error: failed to start server`);
                fields.pid = -1;
            } else {
                fields.pid = pid;
            }
        } catch (e) {
            console.error(`[${udid}] error: ${e.message}`);
        }

        this.updateDescriptor(fields);
        try {
            const stream = await client.shell(udid, `ip route |grep ${wifi} |grep -v default`);
            const buffer = await ADB.util.readAll(stream);
            const temp = buffer
                .toString()
                .split(' ')
                .filter((i: string) => !!i);
            if (temp.length >= 9) {
                fields.ip = temp[8];
            } else {
                fields.ip = LABEL.FAILED_TO_GET;
            }
        } catch (e) {
            console.error(`[${udid}] error: ${e.message}`);
            fields.ip = LABEL.FAILED_TO_GET;
        }
        return this.updateDescriptor(fields);
    }

    private async getPID(device: AdbKitDevice): Promise<number> {
        const { id: udid } = device;
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

    private spawnServer(device: AdbKitDevice): void {
        const { id: udid } = device;
        const command = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;
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
}
