import * as http from 'http';
import path from 'path';
import { Service } from './Service';
import { Utils } from '../Utils';
import express, { Express } from 'express';

const proto = 'http';
const DEFAULT_PORT = 8000;
const DEFAULT_STATIC_DIR = path.join(__dirname, '../public');

export class HttpServer implements Service {
    private static instance: HttpServer;
    private static PORT = DEFAULT_PORT;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private server?: http.Server;
    private app?: Express;

    protected constructor() {
        // nothing here
    }

    public static getInstance(): HttpServer {
        if (!HttpServer.instance) {
            HttpServer.instance = new HttpServer();
        }
        return HttpServer.instance;
    }

    public static setPort(port: number): void {
        if (HttpServer.instance) {
            throw Error('Unable to change value after instantiation');
        }
        HttpServer.PORT = port;
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

    public getPort(): number {
        return HttpServer.PORT;
    }

    public getServer(): http.Server | undefined {
        return this.server;
    }

    public getName(): string {
        return `HTTP Server {tcp:${HttpServer.PORT}}`;
    }

    public start(): void {
        this.app = express();
        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            this.app.use(express.static(HttpServer.PUBLIC_DIR));
        }
        this.server = http.createServer(this.app).listen(HttpServer.PORT, () => {
            Utils.printListeningMsg(proto, HttpServer.PORT);
        });
    }

    public release(): void {
        this.server?.close();
    }
}
