import WebSocket from 'ws';
import { ReleasableService } from './ReleasableService';
import { Message } from '../common/Message';
import DroidDeviceDescriptor from '../common/DroidDeviceDescriptor';
import { DeviceTrackerCommand } from '../common/DeviceTrackerCommand';
import { AndroidDeviceTracker } from './services/AndroidDeviceTracker';

export class ServiceDeviceTracker extends ReleasableService {
    private adt: AndroidDeviceTracker = AndroidDeviceTracker.getInstance();

    constructor(ws: WebSocket) {
        super(ws);

        this.adt
            .init()
            .then(() => {
                this.adt.on('device', this.buildAndSendMessage);
                this.buildAndSendMessage(this.adt.getDevices());
            })
            .catch((e: Error) => {
                console.error(`Error: ${e.message}`);
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

    public static createService(ws: WebSocket): ReleasableService {
        return new ServiceDeviceTracker(ws);
    }

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        let data;
        try {
            data = JSON.parse(event.data.toString());
        } catch (e) {
            console.log(`Received message: ${event.data}`);
            return;
        }
        if (!data || !data.command) {
            console.log(`Received message: ${event.data}`);
            return;
        }
        const command = data.command;
        switch (command) {
            case DeviceTrackerCommand.KILL_SERVER: {
                const { udid, pid } = data;
                if (typeof udid === 'string' && udid && typeof pid === 'number' && pid > 0) {
                    this.adt.killServer(udid, pid).catch((e) => {
                        const { message } = e;
                        console.error(`Command: "${command}", error: ${message}`);
                        this.ws.send({ command, error: message });
                    });
                } else {
                    console.error(`Incorrect parameters for ${data.command} command: udid:"${udid}"`);
                }
                break;
            }
            case DeviceTrackerCommand.START_SERVER: {
                const { udid } = data;
                if (typeof udid === 'string' && udid) {
                    this.adt.startServer(udid).catch((e) => {
                        const { message } = e;
                        console.error(`Command: "${command}", error: ${message}`);
                        this.ws.send({ command, error: message });
                    });
                } else {
                    console.error(`Incorrect parameters for ${data.command} command: udid:"${udid}"`);
                }
                break;
            }
            default:
                console.warn(`Unsupported command: "${data.command}"`);
        }
    }

    public release(): void {
        super.release();
        this.adt.off('device', this.buildAndSendMessage);
    }
}
