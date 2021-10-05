import * as http from 'http';
import * as https from 'https';
import path from 'path';
import { Service } from './Service';
import { Utils } from '../Utils';
import express, { Express } from 'express';
import { Config } from '../Config';

const DEFAULT_STATIC_DIR = path.join(__dirname, './public');

export type ServerAndPort = {
    server: https.Server | http.Server;
    port: number;
};

export class HttpServer implements Service {
    private static instance: HttpServer;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private servers: ServerAndPort[] = [];
    private app?: Express;

    protected constructor() {
        // nothing here
    }

    public static getInstance(): HttpServer {
        if (!this.instance) {
            this.instance = new HttpServer();
        }
        return this.instance;
    }

    public static hasInstance(): boolean {
        return !!this.instance;
    }

    public static setPublicDir(dir: string): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.PUBLIC_DIR = dir;
    }

    public static setServeStatic(enabled: boolean): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.SERVE_STATIC = enabled;
    }

    public getServers(): ServerAndPort[] {
        return [...this.servers];
    }

    public getName(): string {
        return `HTTP(s) Server Service`;
    }

    public start(): void {
        this.app = express();
        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            this.app.use(express.static(HttpServer.PUBLIC_DIR));
        }
        const config = Config.getInstance();
        config.getServers().forEach((serverItem) => {
            const { secure, port } = serverItem;
            let proto: string;
            let server: http.Server | https.Server;
            if (secure) {
                if (!serverItem.options) {
                    throw Error('Must provide option for secure server configuration');
                }
                let { key, cert } = serverItem.options;
                const { keyPath, certPath } = serverItem.options;
                if (!key) {
                    if (typeof keyPath !== 'string') {
                        throw Error('Must provide parameter "key" or "keyPath"');
                    }
                    key = config.readFile(keyPath);
                }
                if (!cert) {
                    if (typeof certPath !== 'string') {
                        throw Error('Must provide parameter "cert" or "certPath"');
                    }
                    cert = config.readFile(certPath);
                }
                const options = { ...serverItem.options, cert, key };
                server = https.createServer(options, this.app);
                proto = 'https';
            } else {
                const options = serverItem.options ? { ...serverItem.options } : {};
                server = http.createServer(options, this.app);
                proto = 'http';
            }
            this.servers.push({ server, port });
            server.listen(port, () => {
                Utils.printListeningMsg(proto, port);
            });
        });
    }

    public release(): void {
        this.servers.forEach((item) => {
            item.server.close();
        });
    }
}
