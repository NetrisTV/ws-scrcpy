import Adb from '@dead50f7/adbkit/lib/adb';
import { ExtendedClient } from './ExtendedClient';
import { ClientOptions } from '@dead50f7/adbkit/lib/ClientOptions';

interface Options {
    host?: string;
    port?: number;
    bin?: string;
}

export class AdbExtended extends Adb {
    static createClient(options: Options = {}): ExtendedClient {
        const opts: ClientOptions = {
            bin: options.bin,
            host: options.host || process.env.ADB_HOST || '127.0.0.1',
            port: options.port || 0,
        };
        if (!opts.port) {
            const port = parseInt(process.env.ADB_PORT || '', 10);
            if (!isNaN(port)) {
                opts.port = port;
            } else {
                opts.port = 5037;
            }
        }
        return new ExtendedClient(opts);
    }
}
