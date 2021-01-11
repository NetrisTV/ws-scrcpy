import OriginalAdb from '@devicefarmer/adbkit/lib/adb';
import { ClientOptions } from '@devicefarmer/adbkit/lib/ClientOptions';
import { Client } from './Client';

interface Options {
    host?: string;
    port?: number;
    bin?: string;
}

export class Adb extends OriginalAdb {
    public static createClient(options: Options = {}): Client {
        let port = 5037;
        if (!options.port) {
            if (process.env.ADB_PORT) {
                const p = parseInt(process.env.ADB_PORT, 10);
                if (!isNaN(p)) {
                    port = p;
                }
            }
        } else {
            port = options.port;
        }
        const opts: ClientOptions = {
            bin: options.bin,
            host: options.host || process.env.ADB_HOST,
            port: port,
        };
        return new Client(opts);
    }
}
