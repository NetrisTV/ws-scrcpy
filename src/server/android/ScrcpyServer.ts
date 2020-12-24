import '../../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../../vendor/Genymobile/scrcpy/LICENSE.txt';

import { Device } from './Device';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_PROCESS_NAME, SERVER_VERSION } from '../Constants';
import path from 'path';
import PushTransfer from '@devicefarmer/adbkit/lib/adb/sync/pushtransfer';

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(__dirname, 'vendor/Genymobile/scrcpy');
const FILE_NAME = 'scrcpy-server.jar';
const RUN_COMMAND = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;

export class ScrcpyServer {
    private static async copyServer(device: Device): Promise<PushTransfer> {
        const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        return device.push(src, dst);
    }

    private static async waitForServerPid(device: Device, tryCounter = 0): Promise<number[] | undefined> {
        const list = await this.getServerPid(device);
        if (Array.isArray(list) && list.length) {
            return list;
        }
        if (tryCounter > 5) {
            throw new Error('Failed to start server');
        }
        return new Promise<number[] | undefined>((resolve) => {
            tryCounter++;
            setTimeout(() => {
                resolve(this.waitForServerPid(device, tryCounter));
            }, 100 + tryCounter);
        });
    }

    public static async getServerPid(device: Device): Promise<number[] | undefined> {
        if (!device.isConnected()) {
            return;
        }
        const list = await device.getPidOf(SERVER_PROCESS_NAME);
        if (!Array.isArray(list) || !list.length) {
            return;
        }
        const serverPid: number[] = [];
        const promises = list.map((pid) => {
            return device.runShellCommandAdbKit(`cat /proc/${pid}/cmdline`).then((output) => {
                const args = output.split('\0');
                if (args[0] === SERVER_PROCESS_NAME && args[2] === SERVER_PACKAGE && args[3] === SERVER_VERSION) {
                    serverPid.push(pid);
                }
                return;
            });
        });
        await Promise.all(promises);
        return serverPid;
    }

    public static async run(device: Device): Promise<number[] | undefined> {
        if (!device.isConnected()) {
            return;
        }
        let list: number[] | string | undefined = await this.getServerPid(device);
        if (Array.isArray(list) && list.length) {
            return list;
        }
        await this.copyServer(device);

        list = await Promise.race([device.runShellCommandAdbKit(RUN_COMMAND), this.waitForServerPid(device)]);
        if (Array.isArray(list) && list.length) {
            return list;
        }
        return;
    }
}
