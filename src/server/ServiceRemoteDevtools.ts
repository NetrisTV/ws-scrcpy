import WebSocket from 'ws';
import { ReleasableService } from './ReleasableService';
import { RemoteDevtoolsCommand } from '../common/RemoteDevtoolsCommand';
import { AdbUtils } from './AdbUtils';
import { ACTION } from './Constants';

export class ServiceRemoteDevtools extends ReleasableService {
    public static createService(ws: WebSocket, host: string, udid: string): ServiceRemoteDevtools {
        return new ServiceRemoteDevtools(ws, host, udid);
    }
    constructor(ws: WebSocket, private readonly host: string, private readonly udid: string) {
        super(ws);
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
            case RemoteDevtoolsCommand.LIST_DEVTOOLS: {
                AdbUtils.getRemoteDevtoolsInfo(this.host, this.udid)
                    .then((list) => {
                        this.ws.send(
                            JSON.stringify({
                                type: ACTION.DEVTOOLS,
                                data: list,
                            }),
                        );
                    })
                    .catch((e) => {
                        const { message } = e;
                        console.error(`Command: "${command}", error: ${message}`);
                        this.ws.send(JSON.stringify({ command, error: message }));
                    });
                break;
            }
            default:
                console.warn(`Unsupported command: "${data.command}"`);
        }
    }
}
