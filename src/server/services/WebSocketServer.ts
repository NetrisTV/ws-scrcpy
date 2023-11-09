import { Server as WSServer } from 'ws';
import WS from 'ws';
import { Service } from './Service';
import { HttpServer, ServerAndPort } from './HttpServer';
import { MwFactory } from '../mw/Mw';
import {
    inputBytesGauge,
    inputFramesGauge,
    decodedFramesGauge,
    droppedFramesGauge,
    webSocketConnections,
    playerNames,
} from './PromMetrics';
import { IncomingMessage } from 'http';
import { ACTION } from '../../common/Action';

export class WebSocketServer implements Service {
    private static instance?: WebSocketServer;
    private servers: WSServer[] = [];
    private mwFactories: Set<MwFactory> = new Set();
    private AUTH_EMAIL_HEADER = 'x-goog-authenticated-user-email';

    protected constructor() {
        // nothing here
    }

    public static getInstance(): WebSocketServer {
        if (!this.instance) {
            this.instance = new WebSocketServer();
        }
        return this.instance;
    }

    public static hasInstance(): boolean {
        return !!this.instance;
    }

    public registerMw(mwFactory: MwFactory): void {
        this.mwFactories.add(mwFactory);
    }

    private getUserEmail(request: IncomingMessage): string {
        const userEmailHeader = request.headers[this.AUTH_EMAIL_HEADER];
        if (Array.isArray(userEmailHeader)) {
            return userEmailHeader[0] || 'localhost';
        }

        // format: accounts.google.com:test@google.com
        if (typeof userEmailHeader === 'string') {
            const emailSplit = userEmailHeader.split(':');
            if (emailSplit.length > 1) {
                return emailSplit[1].split('@')[0];
            } else {
                return emailSplit[0];
            }
        }

        return 'localhost';
    }

    private handleMetricsSocket(ws: WS, request: IncomingMessage) {
        const user_email = this.getUserEmail(request);
        ws.on('message', (message) => {
            try {
                if (message instanceof Buffer) {
                    const messageString = message.toString('utf8');

                    const { momentumQualityStats, playerName } = JSON.parse(messageString);
                    const labelValues = { player_name: playerName, user_email };
                    decodedFramesGauge.set(labelValues, momentumQualityStats.decodedFrames);
                    droppedFramesGauge.set(labelValues, momentumQualityStats.droppedFrames);
                    inputFramesGauge.set(labelValues, momentumQualityStats.inputFrames);
                    inputBytesGauge.set(labelValues, momentumQualityStats.inputBytes);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        });

        ws.on('close', () => {
            playerNames.forEach((player_name) => {
                const labelValues = { player_name: player_name, user_email: user_email };
                decodedFramesGauge.remove(labelValues);
                droppedFramesGauge.remove(labelValues);
                inputFramesGauge.remove(labelValues);
                inputBytesGauge.remove(labelValues);
            });
        });
    }

    public attachToServer(item: ServerAndPort): WSServer {
        const { server, port } = item;
        const TAG = `WebSocket Server {tcp:${port}}`;
        const wss = new WSServer({ server });
        wss.on('connection', async (ws: WS, request: IncomingMessage) => {
            if (!request.url) {
                ws.close(4001, `[${TAG}] Invalid url`);
                return;
            }

            if (request.url === '/metrics') {
                this.handleMetricsSocket(ws, request);
                return;
            }
            const user_email = this.getUserEmail(request);
            const url = new URL(request.url, 'https://example.org/');
            const action = url.searchParams.get('action') || '';
            let processed = false;

            if (action === ACTION.PROXY_ADB) {
                webSocketConnections.labels(user_email).inc();
                ws.on('close', () => {
                    webSocketConnections.labels(user_email).dec();
                });
            }

            for (const mwFactory of this.mwFactories.values()) {
                const service = mwFactory.processRequest(ws, { action, request, url });
                if (service) {
                    processed = true;
                }
            }
            if (!processed) {
                ws.close(4002, `[${TAG}] Unsupported request`);
            }
            return;
        });
        wss.on('close', () => {
            console.log(`${TAG} stopped`);
        });
        this.servers.push(wss);
        return wss;
    }

    public getServers(): WSServer[] {
        return this.servers;
    }

    public getName(): string {
        return `WebSocket Server Service`;
    }

    public async start(): Promise<void> {
        const service = HttpServer.getInstance();
        const servers = await service.getServers();
        servers.forEach((item) => {
            this.attachToServer(item);
        });
    }

    public release(): void {
        this.servers.forEach((server) => {
            server.close();
        });
    }
}
