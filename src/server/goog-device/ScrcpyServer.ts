import '../../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../../vendor/Genymobile/scrcpy/LICENSE';

import { Device } from './Device';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_PROCESS_NAME, SERVER_VERSION } from '../../common/Constants';
import path from 'path';
import PushTransfer from '@dead50f7/adbkit/lib/adb/sync/pushtransfer';

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

    private static async waitForProcess(device: Device, tryCounter = 0): Promise<boolean> {
        if (!device.isConnected()) {
            return false;
        }
        const list = await this.getServerPid(device);
        if (Array.isArray(list) && list.length) {
            return true;
        }
        if (tryCounter > 10) {
            throw new Error('Failed to start server');
        }
        const timeout = 300 + 100 * tryCounter;
        return new Promise<boolean>((resolve) => {
            setTimeout(() => {
                resolve(this.waitForProcess(device, tryCounter + 1));
            }, timeout);
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
                if (!args.length || args[0] !== SERVER_PROCESS_NAME) {
                    return;
                }
                let first = args[0];
                while (args.length && first !== SERVER_PACKAGE) {
                    args.shift();
                    first = args[0];
                }
                if (args.length < 2) {
                    return;
                }
                const versionString = args[1];
                if (versionString === SERVER_VERSION) {
                    serverPid.push(pid);
                } else {
                    console.log(
                        device.TAG,
                        `Found different server version running (PID: ${pid}, Version: ${versionString}), killing it`,
                    );
                    device.killProcess(pid);
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
        let list: number[] | undefined = await this.getServerPid(device);
        if (Array.isArray(list) && list.length) {
            return list;
        }
        await this.copyServer(device);

        let processExited = false;
        const runPromise = device.runShellCommandAdb(RUN_COMMAND);
        runPromise
            .then((out) => {
                if (device.isConnected()) {
                    console.log(device.TAG, 'Server exited:', out);
                }
            })
            .catch((e) => {
                console.log(device.TAG, 'Error:', e.message);
            })
            .finally(() => {
                processExited = true;
            });

        // Poll until the scrcpy process appears, or the shell command exits
        const started = await Promise.race([
            runPromise.then(() => false),
            this.waitForProcess(device),
        ]);
        if (processExited || !started) {
            return;
        }
        list = await this.getServerPid(device);
        return list;
    }
}
