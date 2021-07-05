import { BaseClient } from './BaseClient';
import { ACTION } from '../../common/Action';
import { ParsedUrlQuery } from 'querystring';
import { ParamsBase } from '../../types/ParamsBase';
import Util from '../Util';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';

export abstract class ManagerClient<P extends ParamsBase, TE> extends BaseClient<P, TE> {
    public static ACTION = 'unknown';
    public static CODE = 'NONE';
    public static sockets: Map<string, Multiplexer> = new Map();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    public static start(..._rest: any[]): void {
        throw Error('Not implemented');
    }

    protected readonly action?: string;
    protected url: URL;
    protected ws?: Multiplexer | WebSocket;

    protected constructor(params: ParsedUrlQuery | P) {
        super(params);
        this.action = Util.parseStringEnv(params.action);
        this.url = this.buildWebSocketUrl();
    }

    public hasConnection(): boolean {
        return !!(this.ws && this.ws.readyState === this.ws.OPEN);
    }

    protected openNewConnection(): Multiplexer | WebSocket {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.close();
            delete this.ws;
        }
        const url = this.url.toString();
        if (this.supportMultiplexing()) {
            let mpx = ManagerClient.sockets.get(url);
            if (!mpx) {
                const ws = new WebSocket(url);
                ws.addEventListener('close', () => {
                    ManagerClient.sockets.delete(url);
                });
                mpx = new Multiplexer(ws);
                ManagerClient.sockets.set(url, mpx);
            }
            const ws = mpx.createChannel(this.getChannelInitData());
            ws.addEventListener('open', this.onSocketOpen.bind(this));
            ws.addEventListener('message', this.onSocketMessage.bind(this));
            ws.addEventListener('close', this.onSocketClose.bind(this));
            this.ws = ws;
        } else {
            const ws = new WebSocket(url);
            ws.addEventListener('open', this.onSocketOpen.bind(this));
            ws.addEventListener('message', this.onSocketMessage.bind(this));
            ws.addEventListener('close', this.onSocketClose.bind(this));
            this.ws = ws;
        }
        return this.ws;
    }

    public destroy(): void {
        if (this.ws) {
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.close();
            }
        }
    }

    protected buildWebSocketUrl(): URL {
        const directUrl = this.buildDirectWebSocketUrl();
        if (this.params.useProxy && !this.supportMultiplexing()) {
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
        if (this.supportMultiplexing()) {
            directUrl.searchParams.set('action', ACTION.MULTIPLEX);
        } else {
            if (action) {
                directUrl.searchParams.set('action', action);
            }
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

    protected supportMultiplexing(): boolean {
        return false;
    }

    protected getChannelInitData(): Buffer {
        return Buffer.from(ManagerClient.CODE);
    }

    protected abstract onSocketOpen(e: Event): void;
    protected abstract onSocketMessage(e: MessageEvent): void;
    protected abstract onSocketClose(e: CloseEvent): void;
}
