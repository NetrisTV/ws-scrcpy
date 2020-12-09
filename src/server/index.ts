import WebSocket from 'ws';
import * as os from 'os';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as querystring from 'querystring';
import * as readline from 'readline';
import { IncomingMessage, ServerResponse, STATUS_CODES } from 'http';
import { ServiceDeviceTracker } from './ServiceDeviceTracker';
import { ServiceShell } from './ServiceShell';
import { ACTION } from './Constants';
import { ServiceWebsocketProxy } from './ServiceWebsocketProxy';
import { ServiceRemoteDevtools } from './ServiceRemoteDevtools';

const proto = 'http';
const port = parseInt(process.argv[2], 10) || 8000;
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
const PUBLIC_DIR = path.join(__dirname, '../public');

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
        res.statusCode = 400;
        res.end(STATUS_CODES[400]);
        return;
    }
    const parsedUrl = url.parse(req.url);
    let pathname = path.join(PUBLIC_DIR, (parsedUrl.pathname || '.').replace(/^(\.)+/, '.'));
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

const wss = new WebSocket.Server({ server });
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

server.listen(port);

server.on('listening', printListeningMsg);

function printListeningMsg(): void {
    const ipv4List: string[] = [];
    const ipv6List: string[] = [];
    const formatAddress = (ip: string, scopeid: number | undefined): void => {
        if (typeof scopeid === 'undefined') {
            ipv4List.push(`${proto}://${ip}:${port}`);
            return;
        }
        if (scopeid === 0) {
            ipv6List.push(`${proto}://[${ip}]:${port}`);
        } else {
            return;
            // skip
            // ipv6List.push(`${proto}://[${ip}%${scopeid}]:${port}`);
        }
    };
    Object.keys(os.networkInterfaces())
        .map((key) => os.networkInterfaces()[key])
        .forEach((info) => {
            info.forEach((iface) => {
                let scopeid: number | undefined;
                if (iface.family === 'IPv6') {
                    scopeid = iface.scopeid;
                } else if (iface.family === 'IPv4') {
                    scopeid = undefined;
                } else {
                    return;
                }
                formatAddress(iface.address, scopeid);
            });
        });
    const nameList = [encodeURI(`${proto}://${os.hostname()}:${port}`), encodeURI(`${proto}://localhost:${port}`)];
    console.log('Listening on:\n\t' + nameList.join(' '));
    if (ipv4List.length) {
        console.log('\t' + ipv4List.join(' '));
    }
    if (ipv6List.length) {
        console.log('\t' + ipv6List.join(' '));
    }
}

if (process.platform === 'win32') {
    readline
        .createInterface({
            input: process.stdin,
            output: process.stdout,
        })
        .on('SIGINT', () => {
            process.exit();
        });
}

process.on('SIGINT', () => {
    process.exit();
});

process.on('SIGTERM', () => {
    process.exit();
});
