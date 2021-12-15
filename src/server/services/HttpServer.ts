import * as http from 'http';
import { IncomingMessage, ServerResponse, STATUS_CODES } from 'http';
import url from 'url';
import path from 'path';
import fs from 'fs';
import { Service } from './Service';
import { Utils } from '../Utils';

const map: Record<string, string> = {
    '.wasm': 'application/wasm',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.html': 'text/html',
    '.css': 'text/css',
    '.jar': 'application/java-archive',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
};

const proto = 'http';
const PUBLIC_DIR = path.join(__dirname, '../public');

export class HttpServer implements Service {
    private static instance: HttpServer;
    private server?: http.Server;
    private port = parseInt(process.argv[2], 10) || 8000;

    protected constructor() {
        // nothing here
    }

    public static getInstance(): HttpServer {
        if (!HttpServer.instance) {
            HttpServer.instance = new HttpServer();
        }
        return HttpServer.instance;
    }

    private createServer(publicDir: string): http.Server {
        const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
            if (!req.url) {
                res.statusCode = 400;
                res.end(STATUS_CODES[400]);
                return;
            }
            const parsedUrl = url.parse(req.url);
            let pathname = path.join(publicDir, (parsedUrl.pathname || '.').replace(/^(\.)+/, '.'));
            if (pathname.indexOf(publicDir) !== 0) {
                res.statusCode = 403;
                res.end();
                return;
            }
            fs.stat(pathname, (statErr, stat) => {
                if (statErr) {
                    if (statErr.code === 'ENOENT') {
                        // if the file is not found, return 404
                        res.statusCode = 404;
                        res.end(`File ${pathname} not found!`);
                    } else {
                        res.statusCode = 500;
                        res.end(`Error getting the file: ${statErr}.`);
                    }
                    return;
                }
                if (stat.isDirectory()) {
                    pathname = path.join(pathname, 'index.html');
                }
                const ext = path.parse(pathname).ext;
                fs.readFile(pathname, (readErr, data) => {
                    if (readErr) {
                        res.statusCode = 500;
                        res.end(`Error getting the file: ${statErr}.`);
                    } else {
                        // if the file is found, set Content-type and send data
                        res.setHeader('Content-type', map[ext] || 'text/plain');
                        res.end(data);
                    }
                });
            });
        });
        server.on('close', () => {
            console.log(`${this.getName()} stopped`);
        });
        return server;
    }

    public getPort(): number {
        return this.port;
    }

    public getServer(): http.Server | undefined {
        return this.server;
    }

    public getName(): string {
        return `HTTP Server {tcp:${this.port}}`;
    }

    public start(): void {
        this.server = this.createServer(PUBLIC_DIR);
        this.server.listen(this.port, () => {
            Utils.printListeningMsg(proto, this.port);
        });
    }

    public release(): void {
        this.server?.close();
    }
}
