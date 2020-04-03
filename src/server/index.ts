import WebSocket from 'ws';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { IncomingMessage, ServerResponse, STATUS_CODES } from 'http';
import { IDevice, ServerDeviceConnection } from './ServerDeviceConnection';

const port = parseInt(process.argv[2], 10) || 9000;
const map: Record<string, string> = {
    '.wasm': 'application/wasm',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.html': 'text/html',
    '.css': 'text/css',
    '.jar': 'application/java-archive',
    '.json': 'application/json',
    '.jpg': 'image/jpeg'
};
const PUBLIC_DIR = path.join(__dirname, '../public');

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
        res.statusCode = 400;
        res.end(STATUS_CODES[400]);
        return;
    }
    const parsedUrl = url.parse(req.url);
    let pathname = path.join(
        PUBLIC_DIR,
        (parsedUrl.pathname || '.').replace(/^(\.)+/, '.')
    );
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
                res.setHeader('Content-type', map[ext] || 'text/plain' );
                res.end(data);
            }
        });
    });
});

const wss = new WebSocket.Server({ server });
wss.on('connection', async (ws: WebSocket) => {
    const sendDeviceList = (data: IDevice[]) => {
        ws.send(JSON.stringify(data));
    };
    const adbPolling = await ServerDeviceConnection.getInstance();
    sendDeviceList(await adbPolling.getDevices());

    adbPolling.on('update', sendDeviceList);
    ws.on('message', (data: WebSocket.Data) => {
        ws.send(`message received: ${data.toString()}`);
    });
    ws.on('close', () => {
        adbPolling.off('update', sendDeviceList);
    });
});

server.listen(port);

if (process.platform === 'win32') {
    readline.createInterface({
        input: process.stdin,
        output: process.stdout
    }).on('SIGINT', () => {
        process.exit();
    });
}

process.on('SIGINT', () => {
    process.exit();
});

process.on('SIGTERM', () => {
    process.exit();
});
