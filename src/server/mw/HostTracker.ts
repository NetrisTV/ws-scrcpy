import WebSocket from 'ws';
import { Mw, RequestParameters } from './Mw';
import { ACTION } from '../../common/Constants';
import { Config } from '../Config';
import { DeviceTracker } from './DeviceTracker';
import { MessageError, MessageHosts, MessageType } from '../../common/HostTrackerMessage';
import { HostItem } from '../../types/Configuration';

export class HostTracker extends Mw {
    public static readonly TAG = 'HostTracker';
    private static list: HostItem[] = [];

    public static processRequest(ws: WebSocket, params: RequestParameters): HostTracker | undefined {
        if (params.parsedQuery?.action !== ACTION.LIST_HOSTS) {
            return;
        }
        return new HostTracker(ws, params);
    }

    constructor(ws: WebSocket, params: RequestParameters) {
        super(ws);

        if (!HostTracker.list.length) {
            const config = Config.getInstance();
            if (config.isLocalAndroidTrackerEnabled()) {
                HostTracker.list.push(DeviceTracker.buildHostItem(params));
            }
            const remoteList = config.getRemoteAndroidTrackers();
            if (remoteList.length) {
                remoteList.forEach((item) => {
                    HostTracker.list.push(item);
                });
            }
        }
        const message: MessageHosts = {
            id: -1,
            type: MessageType.HOSTS,
            data: HostTracker.list,
        };
        this.sendMessage(message);
    }

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        const message: MessageError = {
            id: -1,
            type: MessageType.ERROR,
            data: `Unsupported message: "${event.data.toString()}"`,
        };
        this.sendMessage(message);
    }

    public release(): void {
        super.release();
    }
}
