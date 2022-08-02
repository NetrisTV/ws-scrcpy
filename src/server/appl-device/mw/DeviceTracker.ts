import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ACTION } from '../../../common/Action';
import { DeviceTrackerEvent } from '../../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../../types/DeviceTrackerEventList';
import { ControlCenter } from '../services/ControlCenter';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';

export class DeviceTracker extends Mw {
    public static readonly TAG = 'IosDeviceTracker';
    public static readonly type = 'ios';
    private icc: ControlCenter = ControlCenter.getInstance();
    private readonly id: string;

    public static processChannel(ws: Multiplexer, code: string): Mw | undefined {
        if (code !== ChannelCode.ATRC) {
            return;
        }
        return new DeviceTracker(ws);
    }

    public static processRequest(ws: WS, params: RequestParameters): DeviceTracker | undefined {
        if (params.action !== ACTION.APPL_DEVICE_LIST) {
            return;
        }
        return new DeviceTracker(ws);
    }

    constructor(ws: WS | Multiplexer) {
        super(ws);

        this.id = this.icc.getId();
        this.icc
            .init()
            .then(() => {
                this.icc.on('device', this.sendDeviceMessage);
                this.buildAndSendMessage(this.icc.getDevices());
            })
            .catch((error: Error) => {
                console.error(`[${DeviceTracker.TAG}] Error: ${error.message}`);
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

    protected onSocketMessage(event: WS.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (error: any) {
            console.error(`[${DeviceTracker.TAG}], Received message: ${event.data}. Error: ${error.message}`);
            return;
        }
        this.icc.runCommand(command).catch((error) => {
            console.error(`[${DeviceTracker.TAG}], Received message: ${event.data}. Error: ${error.message}`);
        });
    }

    public release(): void {
        super.release();
        this.icc.off('device', this.sendDeviceMessage);
    }
}
