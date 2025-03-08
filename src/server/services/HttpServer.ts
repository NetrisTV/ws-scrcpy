import * as http from 'http';
import * as https from 'https';
import path from 'path';
import { Service } from './Service';
import { Utils } from '../Utils';
import express, { Express, Request, Response, NextFunction } from 'express';
import { Config } from '../Config';
import { TypedEmitter } from '../../common/TypedEmitter';
import * as process from 'process';
import { EnvName } from '../EnvName';
import basicAuth from 'express-basic-auth'; // Add this for basic authentication
import * as crypto from 'crypto';


const DEFAULT_STATIC_DIR = path.join(__dirname, './public');

const PATHNAME = process.env[EnvName.WS_SCRCPY_PATHNAME] || __PATHNAME__;

export type ServerAndPort = {
    server: https.Server | http.Server;
    port: number;
};

interface HttpServerEvents {
    started: boolean;
}

export class HttpServer extends TypedEmitter<HttpServerEvents> implements Service {
    private static instance: HttpServer;
    private static PUBLIC_DIR = DEFAULT_STATIC_DIR;
    private static SERVE_STATIC = true;
    private servers: ServerAndPort[] = [];
    private mainApp?: Express;
    private started = false;

    protected constructor() {
        super();
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

    public async getServers(): Promise<ServerAndPort[]> {
        if (this.started) {
            return [...this.servers];
        }
        return new Promise<ServerAndPort[]>((resolve) => {
            this.once('started', () => {
                resolve([...this.servers]);
            });
        });
    }

    public getName(): string {
        return `HTTP(s) Server Service`;
    }

    public verifySignature(req: Request): boolean {
        const SECRET_KEY = process.env.SIGNATURE_SECRET_KEY as string;
        if (!SECRET_KEY) {
            throw new Error('Environment variables SECRET_KEY must be set');
        }
    
        // Construct the full URL including protocol, host, and path
        const host = req.get('host'); // Get the host from the request headers
        const protocol = 'https'; // Get the protocol (http or https)
        const path = req.originalUrl.split('&signature=')[0]; // Get the path and query without the signature
    
        const fullUrl = `${protocol}://${host}${path}`;
    
        console.log(`Full URL being verified: ${fullUrl}`);
    
        // Extract the received signature
        const receivedSignature = req.query.signature as string;
    
        console.log(`Received signature: ${receivedSignature}`);
    
        // Create a HMAC-SHA256 hash of the URL using the secret key
        const hmac = crypto.createHmac('sha256', Buffer.from(SECRET_KEY, 'utf8')); // Use 'utf8' if SECRET_KEY is plain text
        hmac.update(fullUrl);
        const calculatedSignature = hmac.digest('base64');
    
        console.log(`Calculated signature: ${calculatedSignature}`);
    
        // Convert base64 to base64url
        const base64urlSignature = calculatedSignature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        console.log(`Base64url signature: ${base64urlSignature}`);
    
        // Compare the calculated signature with the received signature
        return receivedSignature === base64urlSignature;
    }
    

    public async start(): Promise<void> {
        this.mainApp = express();

        // Ensure environment variables are defined
        const adminUser = process.env.ADMIN_USER;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminUser || !adminPassword) {
            throw new Error('Environment variables ADMIN_USER and ADMIN_PASSWORD must be set');
        }

        // Add basic authentication middleware for the base path
        const authMiddleware = basicAuth({
            users: { 
                [adminUser]: adminPassword 
            },
            challenge: true,
            realm: 'Restricted Access',
        });

        // Protect the base path
        this.mainApp.use((req: Request, res: Response, next: NextFunction) => {
            if (req.path === '/' && req.query.hasHash==='true' && req.query.signature) {
                // Verify the signature for the base URL
                if (this.verifySignature(req)) {
                    next();
                } else {
                    res.status(403).send('Invalid signature');
                }
            } else if (req.path === '/') {
                // Apply authentication for all other cases (including the base URL)
                authMiddleware(req, res, next);
            } else {
                // Allow access to other paths
                next();
            }
        });
        
        
        // this.mainApp.use((req: Request, _res: Response, next: NextFunction) => {
        //     console.log('Protocol:', req.protocol); // Log the protocol (http or https)
        //     next();
        // });

        this.mainApp.post('/logout', (_req: Request, res: Response) => {
            console.log('Logging out');
            res.setHeader('WWW-Authenticate', 'Basic realm="Restricted Access"');
            res.status(401).send('Logged out successfully');
        });

        if (HttpServer.SERVE_STATIC && HttpServer.PUBLIC_DIR) {
            this.mainApp.use(PATHNAME, express.static(HttpServer.PUBLIC_DIR));

            /// #if USE_WDA_MJPEG_SERVER

            const { MjpegProxyFactory } = await import('../mw/MjpegProxyFactory');
            this.mainApp.get('/mjpeg/:udid', new MjpegProxyFactory().proxyRequest);
            /// #endif
        }

        const config = Config.getInstance();
        config.servers.forEach((serverItem) => {
            const { secure, port, redirectToSecure } = serverItem;
            let proto: string;
            let server: http.Server | https.Server;
            if (secure) {
                if (!serverItem.options) {
                    throw Error('Must provide option for secure server configuration');
                }
                server = https.createServer(serverItem.options, this.mainApp);
                proto = 'https';
            } else {
                const options = serverItem.options ? { ...serverItem.options } : {};
                proto = 'http';
                let currentApp = this.mainApp;
                let host = '';
                let port = 443;
                let doRedirect = false;
                if (redirectToSecure === true) {
                    doRedirect = true;
                } else if (typeof redirectToSecure === 'object') {
                    doRedirect = true;
                    if (typeof redirectToSecure.port === 'number') {
                        port = redirectToSecure.port;
                    }
                    if (typeof redirectToSecure.host === 'string') {
                        host = redirectToSecure.host;
                    }
                }
                if (doRedirect) {
                    currentApp = express();
                    currentApp.use(function (req, res) {
                        const url = new URL(`https://${host ? host : req.headers.host}${req.url}`);
                        if (port && port !== 443) {
                            url.port = port.toString();
                        }
                        return res.redirect(301, url.toString());
                    });
                }
                server = http.createServer(options, currentApp);
            }
            this.servers.push({ server, port });
            server.listen(port, () => {
                Utils.printListeningMsg(proto, port, PATHNAME);
            });
        });
        this.started = true;
        this.emit('started', true);
    }

    public release(): void {
        this.servers.forEach((item) => {
            item.server.close();
        });
    }
}