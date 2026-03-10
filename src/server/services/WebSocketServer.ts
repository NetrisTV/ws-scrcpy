import { Server as WSServer } from 'ws';
import WS from 'ws';
import crypto from 'crypto';

import { Service } from './Service';
import { HttpServer, ServerAndPort } from './HttpServer';
import { MwFactory } from '../mw/Mw';

import DeviceLock from '../device-lock';

/**
 * Extrai o ID do device a partir do URL (vários formatos possíveis).
 */
function extractDeviceIdFromUrl(url: URL): string | null {
    const keys = ['device', 'udid', 'serial', 'id', 'target', 'name', 'd'];
    for (const k of keys) {
        const v = url.searchParams.get(k);
        if (v && v.trim()) return v.trim();
    }

    // tentar apanhar via pathname
    const m = url.pathname.match(/\/(device|udid|serial)\/([^\/?#]+)/i);
    if (m && m[2]) return decodeURIComponent(m[2].trim());

    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length >= 2) {
        const last = segs[segs.length - 1];
        if (last && last.length > 3) return decodeURIComponent(last);
    }

    return null;
}

/**
 * Extrai o deviceId da primeira mensagem WS (quando não vem no URL).
 */
function extractDeviceIdFromFirstMessage(data: any): string | null {
    try {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);

        // tentar JSON
        try {
            const obj = JSON.parse(text);
            const keys = ['device', 'udid', 'serial', 'id', 'target', 'name'];
            for (const k of keys) {
                if (obj && obj[k] && typeof obj[k] === 'string' && obj[k].trim()) {
                    return obj[k].trim();
                }
            }
        } catch {
            // fallback regex
            const re = /"(device|udid|serial|id|target|name)"\s*:\s*"([^"]+)"/i;
            const match = text.match(re);
            if (match && match[2]) return match[2].trim();
        }
    } catch {
        // ignore
    }
    return null;
}

export class WebSocketServer implements Service {
    private static instance?: WebSocketServer;
    private servers: WSServer[] = [];
    private mwFactories: Set<MwFactory> = new Set();

    protected constructor() {}

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

    /**
     * Broadcast do estado dos devices para todos os clientes WS num dado servidor.
     */
    private broadcastDeviceStatus(wss: WSServer): void {
        const devices = DeviceLock.listActive();

        wss.clients.forEach((client: any) => {
            if (client.readyState === 1) {
                try {
                    client.send(JSON.stringify({
                        type: 'devices_in_use',
                        devices,
                    }));
                } catch {
                    // ignore send errors
                }
            }
        });
    }

    public attachToServer(item: ServerAndPort): WSServer {
        const { server, port } = item;
        const TAG = `WebSocket Server {tcp:${port}}`;

        const wss = new WSServer({ server });

        // sempre que o estado muda, difunde para TODOS os servidores WS registados
        DeviceLock.onUpdate = () => {
            for (const wsServer of this.servers) {
                this.broadcastDeviceStatus(wsServer);
            }
        };

        wss.on('connection', async (ws: WS, request) => {
            // === CONTROLO DE SESSÃO / LOCK POR DEVICE ===
            const sessionId = crypto.randomBytes(16).toString('hex');

            if (!request.url) {
                ws.close(4001, `[${TAG}] Invalid URL`);
                return;
            }

            const url = new URL(request.url, 'https://example.org/');
            let deviceId: string | null = extractDeviceIdFromUrl(url);
            let locked = false;

            // 1) tenta bloquear logo pela URL
            if (deviceId) {
                if (!DeviceLock.lockDevice(deviceId, sessionId, ws)) {
                    try {
                        ws.send(JSON.stringify({ type: 'error', message: 'DEVICE_IN_USE' }));
                    } catch {}
                    ws.close();
                    return;
                }
                locked = true;

                // confirma sessão ao cliente
                try {
                    ws.send(JSON.stringify({ type: 'session_started', sessionId, deviceId }));
                } catch {}
            } else {
                // 2) lazy lock: descobrir o device na 1.ª mensagem
                const onFirstMessage = (data: any) => {
                    if (locked) return;
                    const guessed = extractDeviceIdFromFirstMessage(data);
                    if (!guessed) return;

                    deviceId = guessed;

                    if (!DeviceLock.lockDevice(deviceId, sessionId, ws)) {
                        try {
                            ws.send(JSON.stringify({ type: 'error', message: 'DEVICE_IN_USE' }));
                        } catch {}
                        ws.close();
                        return;
                    }
                    locked = true;

                    try {
                        ws.send(JSON.stringify({ type: 'session_started', sessionId, deviceId }));
                    } catch {}
                };

                // prioridade antes de outros listeners (quando suportado)
                (ws as any).prependListener?.('message', onFirstMessage);
                ws.on('message', onFirstMessage);
            }

            // refresca timeout em cada mensagem
            ws.on('message', () => {
                if (deviceId) {
                    DeviceLock.refresh(deviceId, sessionId);
                }
            });

            // liberta o device ao fechar
            ws.on('close', () => {
                if (deviceId) {
                    DeviceLock.unlock(deviceId, sessionId);
                }
            });

            // === PIPELINE ORIGINAL DE MIDDLEWARES ===
            const action = url.searchParams.get('action') || '';
            let processed = false;

            for (const mwFactory of this.mwFactories.values()) {
                const service = mwFactory.processRequest(ws, { action, request, url });
                if (service) {
                    processed = true;
                }
            }

            if (!processed) {
                ws.close(4002, `[${TAG}] Unsupported request`);
            }
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
