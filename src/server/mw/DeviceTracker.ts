import WebSocket from 'ws';
import { Mw, RequestParameters } from './Mw';
import { ControlCenterCommand } from '../../common/ControlCenterCommand';
import { AndroidControlCenter } from '../services/AndroidControlCenter';
import { ACTION } from '../../common/Constants';
import DroidDeviceDescriptor from '../../types/DroidDeviceDescriptor';
import { DeviceTrackerEvent } from '../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../types/DeviceTrackerEventList';
import { HostItem } from '../../types/Configuration';

export class DeviceTracker extends Mw {
    public static readonly TAG = 'DeviceTracker';
    private adt: AndroidControlCenter = AndroidControlCenter.getInstance();
    private readonly id: string;

    public static processRequest(ws: WebSocket, params: RequestParameters): DeviceTracker | undefined {
        if (params.parsedQuery?.action !== ACTION.DROID_DEVICE_LIST) {
            return;
        }
        return new DeviceTracker(ws);
    }

    public static buildHostItem(params: RequestParameters): HostItem {
        const type = 'android';
        const host = params.request.headers.host || '127.0.0.1';
        const temp = host.split(':');
        let hostname = host;
        let port = '80';
        if (temp.length > 1) {
            hostname = temp[0];
            port = temp[1];
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

        this.id = this.adt.getId();
        this.adt
            .init()
            .then(() => {
                this.adt.on('device', this.sendDeviceMessage);
                this.buildAndSendMessage(this.adt.getDevices());
            })
            .catch((e: Error) => {
                console.error(`[${DeviceTracker.TAG}] Error: ${e.message}`);
            });
    }

    private sendDeviceMessage = (device: DroidDeviceDescriptor): void => {
        const data: DeviceTrackerEvent<DroidDeviceDescriptor> = {
            device,
            id: this.id,
            name: this.adt.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'device',
            data,
        });
    };

    private buildAndSendMessage = (list: DroidDeviceDescriptor[]): void => {
        const data: DeviceTrackerEventList<DroidDeviceDescriptor> = {
            list,
            id: this.id,
            name: this.adt.getName(),
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
        this.adt.runCommand(command).catch((e) => {
            console.error(`[${DeviceTracker.TAG}], Received message: ${event.data}. Error: ${e.message}`);
        });
    }

    public release(): void {
        super.release();
        this.adt.off('device', this.sendDeviceMessage);
    }
}
