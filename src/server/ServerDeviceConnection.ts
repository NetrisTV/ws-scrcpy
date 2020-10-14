import '../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../vendor/Genymobile/scrcpy/LICENSE.txt';

import ADB, { AdbKitChangesSet, AdbKitClient, AdbKitTracker, PushTransfer } from '@devicefarmer/adbkit';
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
    private pendingInfoUpdate: Set<string> = new Set();
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
                    const { id: udid, type: state } = device;
                    this.updateDeviceInfo(udid, state);
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
                    const { id: udid, type: state } = device;
                    this.updateDeviceInfo(udid, state);
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

    private getOrCreateClient(udid: string): AdbKitClient {
        let client: AdbKitClient | undefined;
        if (this.clientMap.has(udid)) {
            client = this.clientMap.get(udid);
        }
        if (!client) {
            client = ADB.createClient();
            this.clientMap.set(udid, client);
        }
        return client;
    }

    private async setNetInterfaces(udid: string, fields: DroidDeviceDescriptor): Promise<void> {
        const client = ADB.createClient();
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
        fields.interfaces = list;
        this.updateDescriptor(fields);
    }

    private async setProps(udid: string, fields: DroidDeviceDescriptor): Promise<void> {
        const client = ADB.createClient();
        const props = await client.getProperties(udid);
        fields['ro.product.cpu.abi'] = props['ro.product.cpu.abi'];
        fields['product.manufacturer'] = props['ro.product.manufacturer'];
        fields['product.model'] = props['ro.product.model'];
        fields['build.version.release'] = props['ro.build.version.release'];
        fields['build.version.sdk'] = props['ro.build.version.sdk'];
        fields['wifi.interface'] = props['wifi.interface'];
        this.updateDescriptor(fields);
    }

    private async pushAndSpawnServer(udid: string, fields: DroidDeviceDescriptor): Promise<void> {
        try {
            let pid = await this.getPid(udid);
            const isIgnored = this.ignoredDevices.has(udid);
            if (!isIgnored) {
                let count = 0;
                if (isNaN(pid)) {
                    await this.copyServer(udid);
                }
                while (isNaN(pid) && count < 5) {
                    this.spawnServer(udid);
                    pid = await this.getPid(udid);
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
    }

    private async getDescriptor(udid: string, state: string): Promise<void> {
        const fields: DroidDeviceDescriptor = {
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
        if (state === 'offline') {
            this.updateDescriptor(fields);
            return;
        }
        const steps: Promise<void>[] = [];
        const stored = this.deviceDescriptors.get(udid);
        if (stored && stored.sdkVersion) {
            // check only one field, because it is all or nothing
            fields.pid = stored.pid;
            fields.interfaces = stored.interfaces;
            fields['ro.product.cpu.abi'] = stored.cpuAbi;
            fields['product.manufacturer'] = stored.productManufacturer;
            fields['product.model'] = stored.productModel;
            fields['build.version.release'] = stored.releaseVersion;
            fields['build.version.sdk'] = stored.sdkVersion;
            fields['wifi.interface'] = stored.wifiInterface;
        } else {
            steps.push(this.setProps(udid, fields));
        }
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        steps.push(this.setNetInterfaces(udid, fields));
        steps.push(this.pushAndSpawnServer(udid, fields));
        await Promise.all(steps);
    }

    private async checkPid(udid: string, pid: number): Promise<number> {
        const current = await this.getPidWithCommand(udid, `a='/proc/${pid}'; ${CHECK_CMDLINE}`);
        if (pid === current) {
            return pid;
        }
        return NaN;
    }

    private async getPid(udid: string): Promise<number> {
        return this.getPidWithCommand(udid, CMD);
    }

    private async getPidWithCommand(udid: string, command: string): Promise<number> {
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const stream = await client.shell(udid, command);
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

    private async copyServer(udid: string): Promise<PushTransfer> {
        const client = this.getOrCreateClient(udid);
        await client.waitBootComplete(udid);
        const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        return client.push(udid, src, dst);
    }

    private runShellCommand(udid: string, command: string, updateInfoAfterExit: boolean): void {
        const cmd = 'adb';
        const args = ['-s', `${udid}`, 'shell', command];
        const adb = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
            console.log(`[${udid}] adb process (${args.join(' ')}) exited with code ${code}`);
            if (updateInfoAfterExit) {
                this.updateDeviceInfo(udid);
            }
        });
    }

    private spawnServer(udid: string): void {
        const command = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;
        this.runShellCommand(udid, command, true);
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
                    tracker.deviceList.forEach((device) => {
                        const { id: udid, type: state } = device;
                        return this.updateDeviceInfo(udid, state);
                    });
                }
                return [] as DeviceDescriptor[];
            })
            .then(anyway, anyway);
    }

    private updateDeviceInfo(udid: string, maybeState?: string): void {
        if (this.pendingInfoUpdate.has(udid)) {
            return;
        }
        this.pendingInfoUpdate.add(udid);
        let state = maybeState;
        if (!state) {
            const current = this.deviceDescriptors.get(udid);
            state = current ? current.state : '?';
        }
        this.getDescriptor(udid, state)
            .catch((e) => {
                console.error(`[${udid}] error: ${e.message}`);
            })
            .finally(() => {
                this.pendingInfoUpdate.delete(udid);
            });
    }

    public getDevices(): DroidDeviceDescriptor[] {
        this.updateDeviceList();
        return this.cache;
    }

    public killProcess({ udid, pid }: { udid: string; pid: number }): void {
        const command = `kill ${pid}`;
        this.runShellCommand(udid, command, true);
    }

    public async killServer(udid: string, pid: number): Promise<void> {
        let realPid = await this.checkPid(udid, pid);
        if (isNaN(realPid) || realPid < 0) {
            realPid = await this.getPid(udid);
        }
        if (isNaN(realPid) || realPid < 0) {
            console.error(`[${udid}] Can't find server PID`);
            return;
        }
        this.ignoredDevices.add(udid);
        this.killProcess({ udid, pid: realPid });
    }

    public async startServer(udid: string): Promise<void> {
        const descriptor = this.deviceDescriptors.get(udid);
        if (descriptor && !isNaN(descriptor.pid) && descriptor.pid !== -1) {
            const pid = await this.checkPid(udid, descriptor.pid);
            if (!isNaN(pid)) {
                console.error(`[${udid}] Server already running: PID:${descriptor.pid}`);
                return;
            }
        }
        this.ignoredDevices.delete(udid);
        await this.copyServer(udid);
        this.spawnServer(udid);
        this.updateDeviceInfo(udid, descriptor?.state);
    }
}
