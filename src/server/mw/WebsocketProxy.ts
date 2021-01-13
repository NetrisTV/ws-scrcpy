import { Mw, RequestParameters } from './Mw';
import { AdbUtils } from '../AdbUtils';
import WebSocket from 'ws';
import { ACTION } from '../Constants';

export class WebsocketProxy extends Mw {
    public static readonly TAG = 'WebsocketProxy';
    private remoteSocket?: WebSocket;
    private released = false;
    private storage: WebSocket.MessageEvent[] = [];

    public static processRequest(ws: WebSocket, params: RequestParameters): WebsocketProxy | undefined {
        const { parsedQuery, parsedUrl } = params;
        let udid: string | string[] = '';
        let remote: string | string[] = '';
        let path: string | string[] = '';
        let isSuitable = false;
        if (parsedQuery?.action === ACTION.PROXY) {
            isSuitable = true;
            remote = parsedQuery.remote;
            udid = parsedQuery.udid;
            path = parsedQuery.path;
        }
        if (parsedUrl && parsedUrl.path) {
            const temp = parsedUrl.path.split('/');
            // Shortcut for action=proxy, without query string
            if (temp.length >= 4 && temp[0] === '' && temp[1] === ACTION.PROXY) {
                isSuitable = true;
                temp.splice(0, 2);
                udid = decodeURIComponent(temp.shift() || '');
                remote = decodeURIComponent(temp.shift() || '');
                path = temp.join('/') || '/';
            }
        }
        if (!isSuitable) {
            return;
        }
        if (typeof remote !== 'string' || !remote) {
            ws.close(4003, `[${this.TAG}] Invalid value "${remote}" for "remote" parameter`);
            return;
        }
        if (typeof udid !== 'string' || !udid) {
            ws.close(4003, `[${this.TAG}] Invalid value "${udid}" for "udid" parameter`);
            return;
        }
        if (path && typeof path !== 'string') {
            ws.close(4003, `[${this.TAG}] Invalid value "${path}" for "path" parameter`);
            return;
        }
        const service = new WebsocketProxy(ws, udid, remote, path);
        service.init().catch((e) => {
            const msg = `[${this.TAG}] Failed to start service: ${e.message}`;
            console.error(msg);
            ws.close(4005, msg);
        });
        return service;
    }

    constructor(
        ws: WebSocket,
        private readonly udid: string,
        private readonly remote: string,
        private readonly path?: string,
    ) {
        super(ws);
    }

    public async init(): Promise<void> {
        const port = await AdbUtils.forward(this.udid, this.remote);
        const remoteSocket = new WebSocket(`ws://127.0.0.1:${port}${this.path ? this.path : ''}`);

        remoteSocket.onopen = () => {
            this.remoteSocket = remoteSocket;
            this.flush();
        };
        remoteSocket.onmessage = (event) => {
            if (this.ws && this.ws.readyState === this.ws.OPEN) {
                this.ws.send(event.data);
            }
        };
        remoteSocket.onclose = (e) => {
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.close(e.wasClean ? 1000 : 4010);
            }
        };
        remoteSocket.onerror = (e) => {
            if (this.ws.readyState === this.ws.OPEN) {
                this.ws.close(4011, e.message);
            }
        };
    }

    private flush(): void {
        if (this.remoteSocket) {
            while (this.storage.length) {
                const event = this.storage.shift();
                if (event && event.data) {
                    this.remoteSocket.send(event.data);
                }
            }
            if (this.released) {
                this.remoteSocket.close();
            }
        }
        this.storage.length = 0;
    }

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        if (this.remoteSocket) {
            this.remoteSocket.send(event.data);
        } else {
            this.storage.push(event);
        }
    }

    public release(): void {
        super.release();
        this.released = true;
        this.flush();
    }
}
