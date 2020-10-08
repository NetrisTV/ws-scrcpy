import ADB from 'adbkit';
import * as portfinder from 'portfinder';

export class Util {
    public static getFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            portfinder.getPort((err, port) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(port);
            });
        });
    }

    public static async forward(serial: string, remote: string): Promise<number> {
        const client = ADB.createClient();
        const forwards = await client.listForwards(serial);
        const forward = forwards.find((item) => {
            return item.remote === remote && item.local.startsWith('tcp:') && item.serial === serial;
        });
        if (forward) {
            const { local } = forward;
            return parseInt(local.split('tcp:')[1], 10);
        }
        const port = await Util.getFreePort();
        const local = `tcp:${port}`;
        await client.forward(serial, local, remote);
        return port;
    }
}
