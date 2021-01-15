import WebSocket from 'ws';
import { Mw, RequestParameters } from './Mw';
import { Message } from '../../common/Message';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import { DeviceTrackerCommand } from '../../common/DeviceTrackerCommand';
import { AndroidDeviceTracker } from '../services/AndroidDeviceTracker';
import { ACTION } from '../Constants';

export class DeviceTracker extends Mw {
    public static readonly TAG = 'DeviceTracker';
    private adt: AndroidDeviceTracker = AndroidDeviceTracker.getInstance();

    public static processRequest(ws: WebSocket, params: RequestParameters): DeviceTracker | undefined {
        if (params.parsedQuery?.action !== ACTION.DEVICE_LIST) {
            return;
        }
        return new DeviceTracker(ws);
    }

    constructor(ws: WebSocket) {
        super(ws);

        this.adt
            .init()
            .then(() => {
                this.adt.on('device', this.buildAndSendMessage);
                this.buildAndSendMessage(this.adt.getDevices());
            })
            .catch((e: Error) => {
                console.error(`[${DeviceTracker.TAG}] Error: ${e.message}`);
            });
    }

    private buildAndSendMessage = (list: DroidDeviceDescriptor | DroidDeviceDescriptor[]): void => {
        const type: string = Array.isArray(list) ? 'devicelist' : 'device';
        const msg: Message = {
            id: -1,
            type,
            data: list,
        };
        this.sendMessage(msg);
    };

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        let data;
        try {
            data = JSON.parse(event.data.toString());
        } catch (e) {
            console.log(`[${DeviceTracker.TAG}], Received message: ${event.data}`);
            return;
        }
        if (!data || !data.command) {
            console.log(`[${DeviceTracker.TAG}], Received message: ${event.data}`);
            return;
        }
        const command = data.command;
        switch (command) {
            case DeviceTrackerCommand.UPDATE_INTERFACES: {
                const { udid } = data;
                if (typeof udid === 'string' && udid) {
                    this.adt.updateInterfaces(udid).catch((e) => {
                        const { message } = e;
                        console.error(`[${DeviceTracker.TAG}], Command: "${command}", error: ${message}`);
                        this.ws.send({ command, error: message });
                    });
                } else {
                    console.error(
                        `[${DeviceTracker.TAG}], Incorrect parameters for ${data.command} command: udid:"${udid}"`,
                    );
                }
                break;
            }
            case DeviceTrackerCommand.KILL_SERVER: {
                const { udid, pid } = data;
                if (typeof udid === 'string' && udid && typeof pid === 'number' && pid > 0) {
                    this.adt.killServer(udid, pid).catch((e) => {
                        const { message } = e;
                        console.error(`[${DeviceTracker.TAG}], Command: "${command}", error: ${message}`);
                        this.ws.send({ command, error: message });
                    });
                } else {
                    console.error(
                        `[${DeviceTracker.TAG}], Incorrect parameters for ${data.command} command: udid:"${udid}"`,
                    );
                }
                break;
            }
            case DeviceTrackerCommand.START_SERVER: {
                const { udid } = data;
                if (typeof udid === 'string' && udid) {
                    this.adt.startServer(udid).catch((e) => {
                        const { message } = e;
                        console.error(`[${DeviceTracker.TAG}], Command: "${command}", error: ${message}`);
                        this.ws.send({ command, error: message });
                    });
                } else {
                    console.error(
                        `[${DeviceTracker.TAG}], Incorrect parameters for ${data.command} command: udid:"${udid}"`,
                    );
                }
                break;
            }
            default:
                console.warn(`[${DeviceTracker.TAG}], Unsupported command: "${data.command}"`);
        }
    }

    public release(): void {
        super.release();
        this.adt.off('device', this.buildAndSendMessage);
    }
}
