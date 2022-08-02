import * as portfinder from 'portfinder';
import * as http from 'http';
import * as path from 'path';
import { ACTION } from '../../common/Action';
import { AdbExtended } from './adb';
import { DevtoolsInfo, RemoteBrowserInfo, RemoteTarget, VersionMetadata } from '../../types/RemoteDevtools';
import { URL } from 'url';
import { Forward } from '@dead50f7/adbkit/lib/Forward';
import Entry from '@dead50f7/adbkit/lib/adb/sync/entry';
import Stats from '@dead50f7/adbkit/lib/adb/sync/stats';
import PullTransfer from '@dead50f7/adbkit/lib/adb/sync/pulltransfer';
import { FileStats } from '../../types/FileStats';
import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';
import { ReadStream } from 'fs';
import PushTransfer from '@dead50f7/adbkit/lib/adb/sync/pushtransfer';

type IncomingMessage = {
    statusCode?: number;
    contentType?: string;
    body: string;
};

const proto = 'http://';
const fakeHost = '127.0.0.1:6666';
const fakeHostRe = /127\.0\.0\.1:6666/;

export class AdbUtils {
    private static async formatStatsMin(entry: Entry): Promise<FileStats> {
        return {
            name: entry.name,
            isDir: entry.isDirectory() ? 1 : 0,
            size: entry.size,
            dateModified: entry.mtimeMs ? entry.mtimeMs : entry.mtime.getTime(),
        };
    }

    public static async push(serial: string, stream: ReadStream, pathString: string): Promise<PushTransfer> {
        const client = AdbExtended.createClient();
        const transfer = await client.push(serial, stream, pathString);
        client.on('error', (error: Error) => {
            transfer.emit('error', error);
        });
        return transfer;
    }

    public static async stats(serial: string, pathString: string, stats?: Stats, deep = 0): Promise<Stats> {
        if (!stats || (stats.isSymbolicLink() && pathString.endsWith('/'))) {
            const client = AdbExtended.createClient();
            stats = await client.stat(serial, pathString);
        }
        if (stats.isSymbolicLink()) {
            if (deep === 5) {
                throw Error('Too deep');
            }
            if (!pathString.endsWith('/')) {
                pathString += '/';
            }
            try {
                stats = await this.stats(serial, pathString, stats, deep++);
            } catch (error: any) {
                if (error.message === 'Too deep') {
                    if (deep === 0) {
                        console.error(`Symlink is too deep: ${pathString}`);
                        return stats;
                    }
                    throw error;
                }
                if (error.code !== 'ENOENT') {
                    console.error(error.message);
                }
            }
            return stats;
        }
        return stats;
    }

    public static async readdir(serial: string, pathString: string): Promise<FileStats[]> {
        const client = AdbExtended.createClient();
        const list = await client.readdir(serial, pathString);
        const all = list.map(async (entry) => {
            if (entry.isSymbolicLink()) {
                const stat = await this.stats(serial, path.join(pathString, entry.name));
                const mtime = stat.mtimeMs ? stat.mtimeMs : stat.mtime.getTime();
                entry = new Entry(entry.name, stat.mode, stat.size, (mtime / 1000) | 0);
            }
            return AdbUtils.formatStatsMin(entry);
        });
        return Promise.all(all);
    }

    public static async pipePullFile(serial: string, pathString: string): Promise<PullTransfer> {
        const client = AdbExtended.createClient();
        const transfer = await client.pull(serial, pathString);

        transfer.on('progress', function (stats) {
            console.log('[%s] [%s] Pulled %d bytes so far', serial, pathString, stats.bytesTransferred);
        });
        transfer.on('end', function () {
            console.log('[%s] [%s] Pull complete', serial, pathString);
        });
        return new Promise((resolve, reject) => {
            transfer.on('readable', () => {
                resolve(transfer);
            });
            transfer.on('error', (e) => {
                reject(e);
            });
        });
    }

    public static async pipeStatToStream(serial: string, pathString: string, stream: Multiplexer): Promise<void> {
        const client = AdbExtended.createClient();
        return client.pipeStat(serial, pathString, stream);
    }

    public static async pipeReadDirToStream(serial: string, pathString: string, stream: Multiplexer): Promise<void> {
        const client = AdbExtended.createClient();
        return client.pipeReadDir(serial, pathString, stream);
    }

    public static async pipePullFileToStream(serial: string, pathString: string, stream: Multiplexer): Promise<void> {
        const client = AdbExtended.createClient();
        const transfer = await client.pull(serial, pathString);
        transfer.on('data', (data) => {
            stream.send(Buffer.concat([Buffer.from(Protocol.DATA, 'ascii'), data]));
        });
        return new Promise((resolve, reject) => {
            transfer.on('end', function () {
                stream.send(Buffer.from(Protocol.DONE, 'ascii'));
                stream.close();
                resolve();
            });
            transfer.on('error', (e) => {
                reject(e);
            });
        });
    }

    public static async forward(serial: string, remote: string): Promise<number> {
        const client = AdbExtended.createClient();
        const forwards = await client.listForwards(serial);
        const forward = forwards.find((item: Forward) => {
            return item.remote === remote && item.local.startsWith('tcp:') && item.serial === serial;
        });
        if (forward) {
            const { local } = forward;
            return parseInt(local.split('tcp:')[1], 10);
        }
        const port = await portfinder.getPortPromise();
        const local = `tcp:${port}`;
        await client.forward(serial, local, remote);
        return port;
    }

    public static async getDevtoolsRemoteList(serial: string): Promise<string[]> {
        const client = AdbExtended.createClient();
        const stream = await client.shell(serial, 'cat /proc/net/unix');
        const buffer = await AdbExtended.util.readAll(stream);
        const lines = buffer
            .toString()
            .split('\n')
            .filter((s: string) => {
                if (!s) {
                    return false;
                }
                return s.includes('devtools_remote');
            });
        const names: string[] = [];
        lines.forEach((line: string) => {
            const temp = line.split(' ');
            if (temp.length !== 8) {
                return;
            }
            if (temp[5] === '01') {
                const name = temp[7].substr(1);
                names.push(name);
            }
        });
        return names;
    }

    private static async createHttpRequest(
        serial: string,
        unixSocketName: string,
        url: string,
    ): Promise<IncomingMessage> {
        const client = AdbExtended.createClient();
        const socket = await client.openLocal(serial, `localabstract:${unixSocketName}`);
        const request = new (http.ClientRequest as any)(url, {
            createConnection: () => {
                return socket;
            },
        });
        const message: http.IncomingMessage = await new Promise((resolve, reject) => {
            request.on('response', (r: http.IncomingMessage) => {
                resolve(r);
            });
            request.on('socket', () => {
                request.end();
            });
            request.on('error', (error: Error) => {
                reject(error);
            });
        });
        let data = '';
        return new Promise((resolve, reject) => {
            message.on('data', (d) => {
                data += d;
            });
            message.on('end', () => {
                const { statusCode } = message;
                resolve({
                    statusCode,
                    contentType: message.headers['content-type'],
                    body: data,
                });
            });
            message.on('error', (e) => {
                reject(e);
            });
        });
    }

    private static parseResponse<T>(message: IncomingMessage): T {
        if (!message) {
            throw Error('empty response');
        }
        const { contentType, statusCode } = message;
        if (typeof statusCode !== 'number' || statusCode !== 200) {
            throw Error(`wrong status code: ${statusCode}`);
        }
        if (!contentType?.startsWith('application/json')) {
            throw Error(`wrong content type: ${contentType}`);
        }
        const json = JSON.parse(message.body);
        return json as T;
    }

    private static patchWebSocketDebuggerUrl(host: string, serial: string, socket: string, url: string): string {
        if (url) {
            const remote = `localabstract:${socket}`;
            const path = url.replace(/ws:\/\//, '').replace(fakeHostRe, '');
            return `${host}/${ACTION.PROXY_ADB}/${serial}/${remote}/${path}`;
        }
        return url;
    }

    public static async getRemoteDevtoolsVersion(
        host: string,
        serial: string,
        socket: string,
    ): Promise<VersionMetadata> {
        const data = await this.createHttpRequest(serial, socket, `${proto}${fakeHost}/json/version`);
        if (!data) {
            throw Error('Empty response');
        }
        const metadata = this.parseResponse<VersionMetadata>(data);
        if (metadata.webSocketDebuggerUrl) {
            metadata.webSocketDebuggerUrl = this.patchWebSocketDebuggerUrl(
                host,
                serial,
                socket,
                metadata.webSocketDebuggerUrl,
            );
        }
        return metadata;
    }

    public static async getRemoteDevtoolsTargets(
        host: string,
        serial: string,
        socket: string,
    ): Promise<RemoteTarget[]> {
        const data = await this.createHttpRequest(serial, socket, `${proto}${fakeHost}/json`);
        const list = this.parseResponse<RemoteTarget[]>(data);
        if (!list || !list.length) {
            return [];
        }
        return list.map((target) => {
            const { devtoolsFrontendUrl, webSocketDebuggerUrl } = target;
            if (devtoolsFrontendUrl) {
                let temp = devtoolsFrontendUrl;
                let bundledOnDevice = false;
                const ws = this.patchWebSocketDebuggerUrl(host, serial, socket, webSocketDebuggerUrl);

                if (!temp.startsWith('http')) {
                    bundledOnDevice = true;
                    temp = `${proto}${fakeHost}${temp}`;
                }
                const url = new URL(temp);
                // don't use `url.searchParams.set` here, argument will be url-encoded
                // chrome-devtools.fronted will now work with url-encoded value
                url.searchParams.delete('ws');
                let urlString = url.toString();
                if (urlString.includes('?')) {
                    urlString += '&';
                } else {
                    urlString += '?';
                }
                urlString += `ws=${ws}`;

                if (bundledOnDevice) {
                    urlString = urlString.substr(`${proto}${fakeHost}`.length);
                }
                target.devtoolsFrontendUrl = urlString;
                target.webSocketDebuggerUrl = ws;
            }
            return target;
        });
    }

    public static async getRemoteDevtoolsInfo(host: string, serial: string): Promise<DevtoolsInfo> {
        const list = await this.getDevtoolsRemoteList(serial);
        if (!list || !list.length) {
            const deviceName = await this.getDeviceName(serial);
            return {
                deviceName,
                deviceSerial: serial,
                browsers: [],
            };
        }

        const all: Promise<string | RemoteBrowserInfo>[] = [];
        list.forEach((socket) => {
            const v = this.getRemoteDevtoolsVersion(host, serial, socket).catch((error: Error) => {
                console.error('getRemoteDevtoolsVersion failed:', error.message);
                return {
                    'Android-Package': 'string',
                    Browser: 'string',
                    'Protocol-Version': 'string',
                    'User-Agent': 'string',
                    'V8-Version': 'string',
                    'WebKit-Version': 'string',
                    webSocketDebuggerUrl: 'string',
                };
            });
            const t = this.getRemoteDevtoolsTargets(host, serial, socket).catch((error: Error) => {
                console.error('getRemoteDevtoolsTargets failed:', error.message);
                return [];
            });
            const p = Promise.all([v, t]).then((result) => {
                const [version, targets] = result;
                return {
                    socket,
                    version,
                    targets,
                };
            });
            all.push(p);
        });
        all.unshift(this.getDeviceName(serial));
        const result = await Promise.all(all);
        const deviceName: string = result.shift() as string;
        const browsers: RemoteBrowserInfo[] = result as RemoteBrowserInfo[];
        return {
            deviceName,
            deviceSerial: serial,
            browsers,
        };
    }

    public static async getDeviceName(serial: string): Promise<string> {
        const client = AdbExtended.createClient();
        const props = await client.getProperties(serial);
        return props['ro.product.model'] || 'Unknown device';
    }
}
