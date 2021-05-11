import WebSocket from 'ws';
import { Mw, RequestParameters } from './Mw';
import { ACTION } from '../../common/Action';
import { Config } from '../Config';
import { MessageError, MessageHosts, MessageType } from '../../common/HostTrackerMessage';
import { HostItem } from '../../types/Configuration';

export interface TrackerClass {
    buildParams(host?: string): HostItem;
}

export class HostTracker extends Mw {
    public static readonly TAG = 'HostTracker';
    private static localTrackers: Set<TrackerClass> = new Set<TrackerClass>();
    private static remoteHostItems?: HostItem[];
    private static cache: Map<string, HostItem[]> = new Map();

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

        const host = params.request.headers.host || '127.0.0.1';
        let list = HostTracker.cache.get(host);
        if (!list) {
            const config = Config.getInstance();
            const temp: HostItem[] = [];
            HostTracker.localTrackers.forEach((tracker) => {
                temp.push(tracker.buildParams(params.request.headers.host));
            });

            if (!HostTracker.remoteHostItems) {
                HostTracker.remoteHostItems = Array.from(config.getHostList());
            }
            list = temp.concat(HostTracker.remoteHostItems);
            HostTracker.cache.set(host, list);
        }
        const message: MessageHosts = {
            id: -1,
            type: MessageType.HOSTS,
            data: list,
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
