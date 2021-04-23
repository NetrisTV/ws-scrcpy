import { BaseClient } from './BaseClient';
import { ACTION } from '../../common/Action';
import { ParsedUrlQuery } from 'querystring';
import { ParamsBase } from '../../types/ParamsBase';
import Util from '../Util';

export abstract class ManagerClient<P extends ParamsBase, TE> extends BaseClient<P, TE> {
    public static ACTION = 'unknown';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    public static start(..._rest: any[]): void {
        throw Error('Not implemented');
    }

    protected readonly action?: string;
    protected url: URL;
    protected ws?: WebSocket;

    protected constructor(params: ParsedUrlQuery | P) {
        super(params);
        this.action = Util.parseStringEnv(params.action);
        this.url = this.buildWebSocketUrl();
    }

    public hasConnection(): boolean {
        return !!(this.ws && this.ws.readyState === this.ws.OPEN);
    }

    protected openNewWebSocket(): WebSocket {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.close();
        }
        this.ws = new WebSocket(this.url.toString());
        this.ws.onopen = this.onSocketOpen.bind(this);
        this.ws.onmessage = this.onSocketMessage.bind(this);
        this.ws.onclose = this.onSocketClose.bind(this);
        return this.ws;
    }

    public destroy(): void {
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.close();
            }
        }
    }

    protected buildWebSocketUrl(): URL {
        const directUrl = this.buildDirectWebSocketUrl();
        if (this.params.useProxy) {
            return this.wrapInProxy(directUrl);
        }
        return directUrl;
    }

    protected buildDirectWebSocketUrl(): URL {
        const { hostname, port, secure, action } = this.params;
        let urlString: string;
        if (typeof hostname === 'string' && typeof port === 'number') {
            const protocol = secure ? 'wss:' : 'ws:';
            urlString = `${protocol}//${hostname}:${port}`;
        } else {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

            // location.host includes hostname and port
            urlString = `${protocol}${location.host}`;
        }
        const directUrl = new URL(urlString);
        if (action) {
            directUrl.searchParams.set('action', action);
        }
        return directUrl;
    }

    protected wrapInProxy(directUrl: URL): URL {
        const localProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const localUrl = new URL(`${localProtocol}//${location.host}`);
        localUrl.searchParams.set('action', ACTION.PROXY_WS);
        localUrl.searchParams.set('ws', directUrl.toString());
        return localUrl;
    }

    protected abstract onSocketOpen(e: Event): void;
    protected abstract onSocketMessage(e: MessageEvent): void;
    protected abstract onSocketClose(e: CloseEvent): void;
}
