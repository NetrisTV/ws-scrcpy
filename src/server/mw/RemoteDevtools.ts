import WebSocket from 'ws';
import { Mw, RequestParameters } from './Mw';
import { RemoteDevtoolsCommand } from '../../common/RemoteDevtoolsCommand';
import { AdbUtils } from '../AdbUtils';
import { ACTION } from '../Constants';

export class RemoteDevtools extends Mw {
    public static readonly TAG = 'RemoteDevtools';
    public static processRequest(ws: WebSocket, params: RequestParameters): RemoteDevtools | undefined {
        const { request, parsedQuery } = params;
        if (parsedQuery.action !== ACTION.DEVTOOLS) {
            return;
        }
        const host = request.headers['host'];
        const udid = parsedQuery.udid;
        if (typeof udid !== 'string' || !udid) {
            ws.close(4003, `[${this.TAG}] Invalid value "${udid}" for "udid" parameter`);
            return;
        }
        if (typeof host !== 'string' || !host) {
            ws.close(4003, `[${this.TAG}] Invalid value "${host}" in "Host" header`);
            return;
        }
        return new RemoteDevtools(ws, host, udid);
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
