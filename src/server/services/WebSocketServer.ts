import * as http from 'http';
import WebSocket from 'ws';
import querystring from 'querystring';
import url from 'url';
import { ACTION } from '../Constants';
import { ServiceWebsocketProxy } from '../ServiceWebsocketProxy';
import { ServiceDeviceTracker } from '../ServiceDeviceTracker';
import { ServiceShell } from '../ServiceShell';
import { ServiceRemoteDevtools } from '../ServiceRemoteDevtools';
import { Service } from './Service';
import { HttpServer } from './HttpServer';

export class WebSocketServer implements Service {
    private static instance?: WebSocketServer;
    private server?: WebSocket.Server;
    private port = 0;

    protected constructor() {
        // nothing here
    }

    public static getInstance(): WebSocketServer {
        if (!WebSocketServer.instance) {
            WebSocketServer.instance = new WebSocketServer();
        }
        return WebSocketServer.instance;
    }

    public attachToServer(httpServer: http.Server): WebSocket.Server {
        const wss = new WebSocket.Server({ server: httpServer });
        wss.on('connection', async (ws: WebSocket, req) => {
            if (!req.url) {
                ws.close(4001, 'Invalid url');
                return;
            }
            const host = req.headers['host'];
            const parsed = url.parse(req.url);
            if (parsed && parsed.path) {
                const temp = parsed.path.split('/');
                // Shortcut for action=proxy, without query string
                if (temp.length >= 4 && temp[0] === '' && temp[1] === ACTION.PROXY) {
                    temp.splice(0, 2);
                    const udid = temp.shift();
                    const remote = temp.shift();
                    const path = temp.join('/') || '/';
                    if (udid && remote && path) {
                        const service = ServiceWebsocketProxy.createService(
                            ws,
                            decodeURIComponent(udid),
                            decodeURIComponent(remote),
                            path,
                        );
                        service.init().catch((e) => {
                            const msg = `Failed to start service: ${e.message}`;
                            console.error(msg);
                            ws.close(4005, msg);
                        });
                        return;
                    }
                }
            }
            const parsedQuery = querystring.parse(parsed.query || '');
            if (typeof parsedQuery.action === 'undefined') {
                ws.close(4002, `Missing required parameter "action"`);
            }
            switch (parsedQuery.action) {
                case ACTION.DEVICE_LIST:
                    ServiceDeviceTracker.createService(ws);
                    break;
                case ACTION.SHELL:
                    ServiceShell.createService(ws);
                    break;
                case ACTION.PROXY: {
                    const remote = parsedQuery.remote;
                    if (typeof remote !== 'string' || !remote) {
                        ws.close(4003, `Invalid value "${remote}" for "remote" parameter`);
                        break;
                    }
                    const udid = parsedQuery.udid;
                    if (typeof udid !== 'string' || !udid) {
                        ws.close(4003, `Invalid value "${udid}" for "udid" parameter`);
                        break;
                    }
                    const path = parsedQuery.path;
                    if (path && typeof path !== 'string') {
                        ws.close(4003, `Invalid value "${path}" for "path" parameter`);
                        break;
                    }

                    const service = ServiceWebsocketProxy.createService(ws, udid, remote, path);
                    service.init().catch((e) => {
                        const msg = `Failed to start service: ${e.message}`;
                        console.error(msg);
                        ws.close(4005, msg);
                    });
                    break;
                }
                case ACTION.DEVTOOLS: {
                    const udid = parsedQuery.udid;
                    if (typeof udid !== 'string' || !udid) {
                        ws.close(4003, `Invalid value "${udid}" for "udid" parameter`);
                        break;
                    }
                    if (typeof host !== 'string' || !host) {
                        ws.close(4003, `Invalid value "${host}" in "Host" header`);
                        break;
                    }
                    ServiceRemoteDevtools.createService(ws, host, udid);
                    break;
                }
                default:
                    ws.close(4003, `Invalid value "${parsedQuery.action}" for "action" parameter`);
                    return;
            }
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
