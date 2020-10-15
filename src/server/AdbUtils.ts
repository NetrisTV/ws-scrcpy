import * as portfinder from 'portfinder';
import * as http from 'http';
import { Adb } from './adbkit/lib/adb/Adb';
import { DevtoolsInfo, RemoteTarget, VersionMetadata } from '../common/RemoteDevtools';

export class AdbUtils {
    public static async forward(serial: string, remote: string): Promise<number> {
        const client = Adb.createClient();
        const forwards = await client.listForwards(serial);
        const forward = forwards.find((item) => {
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
        const client = Adb.createClient();
        const stream = await client.shell(serial, 'cat /proc/net/unix');
        const buffer = await Adb.util.readAll(stream);
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
            const name = temp[7].substr(1);
            names.push(name);
        });
        return names;
    }

    private static async createHttpRequest(serial: string, unixSocketName: string, url: string): Promise<string> {
        const client = Adb.createClient();
        const socket = await client.openLocalAbstract(serial, unixSocketName);
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
            request.on('error', (e: Error) => {
                reject(e);
            });
        });
        let data = '';
        return new Promise((resolve, reject) => {
            message.on('data', (d) => {
                data += d;
            });
            message.on('end', () => {
                resolve(data);
            });
            message.on('error', (e) => {
                reject(e);
            });
        });
    }

    public static async getRemoteDevtoolsVersion(serial: string, unixSocketName: string): Promise<VersionMetadata> {
        const data = await this.createHttpRequest(serial, unixSocketName, 'http://127.0.0.1/json/version');
        const json = JSON.parse(data);
        return json as VersionMetadata;
    }

    public static async getRemoteDevtoolsTargets(serial: string, unixSocketName: string): Promise<RemoteTarget[]> {
        const data = await this.createHttpRequest(serial, unixSocketName, 'http://127.0.0.1/json/list');
        const json = JSON.parse(data);
        if (Array.isArray(json)) {
            return json;
        }
        return [];
    }

    public static async getRemoteDevtoolsInfo(serial: string): Promise<DevtoolsInfo[]> {
        const list = await this.getDevtoolsRemoteList(serial);
        if (!list || !list.length) {
            return [];
        }

        const all: Promise<DevtoolsInfo>[] = [];
        list.forEach((socket) => {
            const v = this.getRemoteDevtoolsVersion(serial, socket).catch((e) => {
                return e;
            });
            const t = this.getRemoteDevtoolsTargets(serial, socket).catch((e) => {
                return e;
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
        return Promise.all(all);
    }
}
