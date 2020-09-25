import WebSocket from 'ws';
import { ServerDeviceConnection } from './ServerDeviceConnection';
import { ReleasableService } from './ReleasableService';
import { Message } from '../common/Message';
import DroidDeviceDescriptor from '../common/DroidDeviceDescriptor';

export class ServiceDeviceTracker extends ReleasableService {
    private sdc: ServerDeviceConnection = ServerDeviceConnection.getInstance();

    constructor(ws: WebSocket) {
        super(ws);

        this.sdc
            .init()
            .then(() => {
                this.sdc.addListener(ServerDeviceConnection.UPDATE_EVENT, this.buildAndSendMessage);
                this.buildAndSendMessage(this.sdc.getDevices());
            })
            .catch((e: Error) => {
                console.error(`Error: ${e.message}`);
            });
    }

    private buildAndSendMessage = (list: DroidDeviceDescriptor[]): void => {
        const msg: Message = {
            id: -1,
            type: 'devicelist',
            data: list,
        };
        this.sendMessage(msg);
    };

    public static createService(ws: WebSocket): ReleasableService {
        return new ServiceDeviceTracker(ws);
    }

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        console.log(`Received message: ${event.data}`);
    }

    public release(): void {
        super.release();
        this.sdc.removeListener(ServerDeviceConnection.UPDATE_EVENT, this.buildAndSendMessage);
    }
}
