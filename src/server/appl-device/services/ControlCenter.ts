import { Service } from '../../services/Service';
import { BaseControlCenter } from '../../services/BaseControlCenter';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import * as os from 'os';
import * as crypto from 'crypto';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import { IOSDeviceLib } from 'ios-device-lib';
import { DeviceState } from '../../../common/DeviceState';
import { ProductType } from '../../../common/ProductType';

export class ControlCenter extends BaseControlCenter<ApplDeviceDescriptor> implements Service {
    private static instance?: ControlCenter;

    private initialized = false;
    private tracker?: IOSDeviceLib.IOSDeviceLib;
    private descriptors: Map<string, ApplDeviceDescriptor> = new Map();
    private readonly id: string;

    protected constructor() {
        super();
        const idString = `appl|${os.hostname()}|${os.uptime()}`;
        this.id = crypto.createHash('md5').update(idString).digest('hex');
    }

    public static getInstance(): ControlCenter {
        if (!this.instance) {
            this.instance = new ControlCenter();
        }
        return this.instance;
    }

    public static hasInstance(): boolean {
        return !!ControlCenter.instance;
    }

    private onDeviceUpdate = (device: IOSDeviceLib.IDeviceActionInfo): void => {
        const udid = device.deviceId;
        const state = device.status || '<NoState>';
        const name = device.deviceName || '<NoName>';
        const productType = device.productType || '<NoModel>';
        const version = device.productVersion || '<NoVersion>';
        const model = ProductType.getModel(productType);
        const descriptor = {
            udid,
            name,
            model,
            version,
            state,
            'last.update.timestamp': Date.now(),
        };
        this.descriptors.set(udid, descriptor);
        this.emit('device', descriptor);
    };

    private onDeviceLost = (device: IOSDeviceLib.IDeviceActionInfo): void => {
        const udid = device.deviceId;
        const descriptor = this.descriptors.get(udid);
        if (!descriptor) {
            console.warn(`Received "lost" event for unknown device "${udid}"`);
            return;
        }
        descriptor.state = DeviceState.DISCONNECTED;
        this.emit('device', descriptor);
    };

    public async init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.tracker = await this.startTracker();
        this.initialized = true;
    }

    private async startTracker(): Promise<IOSDeviceLib.IOSDeviceLib> {
        if (this.tracker) {
            return this.tracker;
        }
        this.tracker = new IOSDeviceLib(this.onDeviceUpdate, this.onDeviceUpdate, this.onDeviceLost);
        return this.tracker;
    }

    private stopTracker(): void {
        if (this.tracker) {
            this.tracker.dispose();
            this.tracker = undefined;
        }
        this.tracker = undefined;
        this.initialized = false;
    }

    public getDevices(): ApplDeviceDescriptor[] {
        return Array.from(this.descriptors.values());
    }

    public getId(): string {
        return this.id;
    }

    public getName(): string {
        return `iDevice Tracker [${os.hostname()}]`;
    }

    public start(): Promise<void> {
        return this.init().catch((e) => {
            console.error(`Error: Failed to init "${this.getName()}". ${e.message}`);
        });
    }

    public release(): void {
        this.stopTracker();
    }

    public async runCommand(command: ControlCenterCommand): Promise<string | void> {
        const udid = command.getUdid();
        const device = this.descriptors.get(udid);
        if (!device) {
            console.error(`Device with udid:"${udid}" not found`);
            return;
        }
        const type = command.getType();
        switch (type) {
            default:
                throw new Error(`Unsupported command: "${type}"`);
        }
    }
}
