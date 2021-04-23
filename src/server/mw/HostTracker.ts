import WebSocket from 'ws';
import { Mw, RequestParameters } from './Mw';
import { ACTION } from '../../common/Action';
import { Config } from '../Config';
import { MessageError, MessageHosts, MessageType } from '../../common/HostTrackerMessage';
import { HostItem } from '../../types/Configuration';

export interface TrackerClass {
    buildParams(params: RequestParameters): HostItem;
}

export class HostTracker extends Mw {
    public static readonly TAG = 'HostTracker';
    private static localTrackers: Set<TrackerClass> = new Set<TrackerClass>();
    private static list: HostItem[] = [];

    public static processRequest(ws: WebSocket, params: RequestParameters): HostTracker | undefined {
        if (params.parsedQuery?.action !== ACTION.LIST_HOSTS) {
            return;
        }
        return new HostTracker(ws, params);
    }

    public static registerLocalTracker(tracker: TrackerClass): void {
        this.localTrackers.add(tracker);
    }

    constructor(ws: WebSocket, params: RequestParameters) {
        super(ws);

        if (!HostTracker.list.length) {
            const config = Config.getInstance();
            HostTracker.localTrackers.forEach((tracker) => {
                HostTracker.list.push(tracker.buildParams(params));
            });
            const remoteList = config.getRemoteTrackers();
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
