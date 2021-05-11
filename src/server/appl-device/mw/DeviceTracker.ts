import WebSocket from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ACTION } from '../../../common/Action';
import { DeviceTrackerEvent } from '../../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../../types/DeviceTrackerEventList';
import { ControlCenter } from '../services/ControlCenter';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import { HostItem } from '../../../types/Configuration';

export class DeviceTracker extends Mw {
    public static readonly TAG = 'IosDeviceTracker';
    private icc: ControlCenter = ControlCenter.getInstance();
    private readonly id: string;

    public static processRequest(ws: WebSocket, params: RequestParameters): DeviceTracker | undefined {
        if (params.parsedQuery?.action !== ACTION.APPL_DEVICE_LIST) {
            return;
        }
        return new DeviceTracker(ws);
    }

    // from TrackerClass interface in HostTracker.ts
    public static buildParams(host = '127.0.0.1'): HostItem {
        const type = 'ios';
        const port = 8000;
        const temp = host.split(':');
        let hostname = host;
        if (temp.length > 1) {
            hostname = temp[0];
        }
        return {
            secure: false,
            type,
            hostname,
            port,
        };
    }

    constructor(ws: WebSocket) {
        super(ws);

        this.id = this.icc.getId();
        this.icc
            .init()
            .then(() => {
                this.icc.on('device', this.sendDeviceMessage);
                this.buildAndSendMessage(this.icc.getDevices());
            })
            .catch((e: Error) => {
                console.error(`[${DeviceTracker.TAG}] Error: ${e.message}`);
            });
    }

    private sendDeviceMessage = (device: ApplDeviceDescriptor): void => {
        const data: DeviceTrackerEvent<ApplDeviceDescriptor> = {
            device,
            id: this.id,
            name: this.icc.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'device',
            data,
        });
    };

    private buildAndSendMessage = (list: ApplDeviceDescriptor[]): void => {
        const data: DeviceTrackerEventList<ApplDeviceDescriptor> = {
            list,
            id: this.id,
            name: this.icc.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'devicelist',
            data,
        });
    };

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (e) {
            console.error(`[${DeviceTracker.TAG}], Received message: ${event.data}. Error: ${e.message}`);
            return;
        }
        this.icc.runCommand(command).catch((e) => {
            console.error(`[${DeviceTracker.TAG}], Received message: ${event.data}. Error: ${e.message}`);
        });
    }

    public release(): void {
        super.release();
        this.icc.off('device', this.sendDeviceMessage);
    }
}
