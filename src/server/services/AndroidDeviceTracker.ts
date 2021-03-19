import { TrackerChangeSet } from '@devicefarmer/adbkit/lib/TrackerChangeSet';
import { Device } from '../android/Device';
import { TypedEmitter } from '../../app/TypedEmitter';
import { Service } from './Service';
import AdbKitClient from '@devicefarmer/adbkit/lib/adb/client';
import AdbKit from '@devicefarmer/adbkit';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import Tracker from '@devicefarmer/adbkit/lib/adb/tracker';
import Timeout = NodeJS.Timeout;
import { NetInterface } from '../../common/NetInterface';

export interface AndroidDeviceTrackerEvents {
    device: DroidDeviceDescriptor;
}

export class AndroidDeviceTracker extends TypedEmitter<AndroidDeviceTrackerEvents> implements Service {
    private static readonly defaultWaitAfterError = 1000;
    private static instance?: AndroidDeviceTracker;

    private initialized = false;
    private client: AdbKitClient = AdbKit.createClient();
    private tracker?: Tracker;
    private waitAfterError = 1000;
    private restartTimeoutId?: Timeout;
    private deviceMap: Map<string, Device> = new Map();
    private descriptors: Map<string, DroidDeviceDescriptor> = new Map();

    protected constructor() {
        super();
    }

    public static getInstance(): AndroidDeviceTracker {
        if (!this.instance) {
            this.instance = new AndroidDeviceTracker();
        }
        return this.instance;
    }

    private restartTracker = (): void => {
        if (this.restartTimeoutId) {
            return;
        }
        console.log(`Device tracker is down. Will try to restart in ${this.waitAfterError}ms`);
        this.restartTimeoutId = setTimeout(() => {
            this.stopTracker();
            this.waitAfterError *= 1.2;
            this.init();
        }, this.waitAfterError);
    };

    private onChangeSet = (changes: TrackerChangeSet): void => {
        this.waitAfterError = AndroidDeviceTracker.defaultWaitAfterError;
        if (changes.added.length) {
            for (const item of changes.added) {
                const { id, type } = item;
                this.handleConnected(id, type);
            }
        }
        if (changes.removed.length) {
            for (const item of changes.removed) {
                const { id } = item;
                this.handleConnected(id, 'disconnected');
            }
        }
        if (changes.changed.length) {
            for (const item of changes.changed) {
                const { id, type } = item;
                this.handleConnected(id, type);
            }
        }
    };

    private onDeviceUpdate = (device: Device): void => {
        const { udid, descriptor } = device;
        this.descriptors.set(udid, descriptor);
        this.emit('device', descriptor);
    };

    private handleConnected(udid: string, state: string): void {
        let device = this.deviceMap.get(udid);
        if (device) {
            device.setState(state);
        } else {
            device = new Device(udid, state);
            device.on('update', this.onDeviceUpdate);
            this.deviceMap.set(udid, device);
        }
    }

    public async init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.tracker = await this.startTracker();
        const list = await this.client.listDevices();
        list.forEach((device) => {
            const { id, type } = device;
            this.handleConnected(id, type);
        });
        this.initialized = true;
    }

    private async startTracker(): Promise<Tracker> {
        if (this.tracker) {
            return this.tracker;
        }
        const tracker = await this.client.trackDevices();
        tracker.on('changeSet', this.onChangeSet);
        tracker.on('end', this.restartTracker);
        tracker.on('error', this.restartTracker);
        return tracker;
    }

    private stopTracker(): void {
        if (this.tracker) {
            this.tracker.off('changeSet', this.onChangeSet);
            this.tracker.off('end', this.restartTracker);
            this.tracker.off('error', this.restartTracker);
            this.tracker.end();
            this.tracker = undefined;
        }
        this.tracker = undefined;
        this.initialized = false;
    }

    public getDevices(): DroidDeviceDescriptor[] {
        return Array.from(this.descriptors.values());
    }

    public async killServer(udid: string, pid: number): Promise<void> {
        const device = this.deviceMap.get(udid);
        if (!device) {
            return;
        }
        return device.killServer(pid);
    }

    public async startServer(udid: string): Promise<number | undefined> {
        const device = this.deviceMap.get(udid);
        if (!device) {
            return;
        }
        return device.startServer();
    }

    public async updateInterfaces(udid: string): Promise<NetInterface[] | undefined> {
        const device = this.deviceMap.get(udid);
        if (!device) {
            return;
        }
        return device.updateInterfaces();
    }

    public getName(): string {
        return `Android Device Tracker`;
    }

    public start(): void {
        this.init().catch((e) => {
            console.error(`Error: Failed to init "${this.getName()}". ${e.message}`);
        });
    }

    public release(): void {
        this.stopTracker();
    }
}
