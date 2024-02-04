import WS from 'ws';
import { Mw, RequestParameters, DeviceTrackerType } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ControlCenter } from '../services/ControlCenter';
import { ACTION } from '../../../common/Action';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DeviceTrackerEvent } from '../../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../../types/DeviceTrackerEventList';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';
import { DeviceProps } from '../Device';

export class DeviceTracker extends Mw {
    public static readonly TAG = 'DeviceTracker';
    public static readonly type = 'android';
    private readonly deviceType: DeviceTrackerType;
    private adt: ControlCenter = ControlCenter.getInstance();
    private readonly id: string;

    public static processChannel(ws: Multiplexer, code: string): Mw | undefined {
        if (code !== ChannelCode.GTRC) {
            return;
        }
        return new DeviceTracker(ws, 'screen');
    }

    public static processRequest(ws: WS, params: RequestParameters): DeviceTracker | undefined {
        if (params.action !== ACTION.GOOG_DEVICE_LIST) {
            return;
        }

        return new DeviceTracker(ws, params.type);
    }

    constructor(ws: WS | Multiplexer, type: DeviceTrackerType) {
        super(ws);
        this.deviceType = type;
        this.id = this.adt.getId();
        this.adt
            .init()
            .then(() => {
                if (this.deviceType === 'screen') {
                    this.adt.on('device', this.sendDeviceMessage);
                    this.buildAndSendMessage(this.adt.getDevices());
                } else {
                    this.adt.on('devicePeriodically', this.sendLiveDeviceMessage);
                    this.buildAndSendMessage(this.adt.getDevices());
                }
            })
            .catch((error: Error) => {
                console.error(`[${DeviceTracker.TAG}] Error: ${error.message}`);
            });
    }

    private sendLiveDeviceMessage = (device: DeviceProps): void => {
        this.sendMessage({
            id: -1,
            type: 'device',
            data: device,
        });
    };

    private sendDeviceMessage = (device: GoogDeviceDescriptor): void => {
        const data: DeviceTrackerEvent<GoogDeviceDescriptor> = {
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

    private buildAndSendMessage = (list: GoogDeviceDescriptor[]): void => {
        const data: DeviceTrackerEventList<GoogDeviceDescriptor> = {
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

    protected onSocketMessage(event: WS.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (error: any) {
            console.error(`[${DeviceTracker.TAG}], Received message: ${event.data}. Error: ${error?.message}`);
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
