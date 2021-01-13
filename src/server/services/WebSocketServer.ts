import * as http from 'http';
import WebSocket from 'ws';
import querystring from 'querystring';
import url from 'url';
import { Service } from './Service';
import { HttpServer } from './HttpServer';
import { MwFactory } from '../mw/Mw';

export class WebSocketServer implements Service {
    private static instance?: WebSocketServer;
    private server?: WebSocket.Server;
    private port = 0;
    private mwFactories: Set<MwFactory> = new Set();

    protected constructor() {
        // nothing here
    }

    public static getInstance(): WebSocketServer {
        if (!WebSocketServer.instance) {
            WebSocketServer.instance = new WebSocketServer();
        }
        return WebSocketServer.instance;
    }

    public registerMw(mwFactory: MwFactory): void {
        this.mwFactories.add(mwFactory);
    }

    public attachToServer(httpServer: http.Server): WebSocket.Server {
        const wss = new WebSocket.Server({ server: httpServer });
        wss.on('connection', async (ws: WebSocket, request) => {
            if (!request.url) {
                ws.close(4001, `[${this.getName()}] Invalid url`);
                return;
            }
            const parsedUrl = url.parse(request.url);
            const parsedQuery = querystring.parse(parsedUrl.query || '');
            let processed = false;
            for (const mwFactory of this.mwFactories.values()) {
                const service = mwFactory.processRequest(ws, { request, parsedUrl, parsedQuery });
                if (service) {
                    processed = true;
                }
            }
            if (!processed) {
                ws.close(4002, `[${this.getName()}] Unsupported request`);
            }
            return;
        });
        wss.on('close', () => {
            console.log(`${this.getName()} stopped`);
        });
        this.server = wss;
        return wss;
    }

    public getServer(): WebSocket.Server | undefined {
        return this.server;
    }

    public getName(): string {
        return `WebSocket Server {tcp:${this.port}}`;
    }

    public start(): void {
        const service = HttpServer.getInstance();
        const server = service.getServer();
        this.port = service.getPort();
        if (server) {
            this.attachToServer(server);
        }
    }

    public release(): void {
        this.server?.close();
    }
}
