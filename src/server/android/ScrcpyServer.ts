import '../../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../../vendor/Genymobile/scrcpy/LICENSE.txt';

import { Device } from './Device';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_PROCESS_NAME, SERVER_VERSION } from '../Constants';
import path from 'path';
import PushTransfer from '@devicefarmer/adbkit/lib/adb/sync/pushtransfer';
import { ServerVersion } from './ServerVersion';

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

    private static async waitForServerPid(
        device: Device,
        params: { tryCounter: number; processExited: boolean },
    ): Promise<number[] | undefined> {
        const { tryCounter, processExited } = params;
        if (processExited) {
            return;
        }
        return new Promise<number[] | undefined>((resolve) => {
            const timeout = 3000 + 100 * tryCounter;
            setTimeout(async () => {
                const list = await this.getServerPid(device);
                if (Array.isArray(list) && list.length) {
                    return resolve(list);
                }
                if (++params.tryCounter > 5) {
                    throw new Error('Failed to start server');
                }
                return resolve(this.waitForServerPid(device, params));
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
                if (args[0] === SERVER_PROCESS_NAME && args[2] === SERVER_PACKAGE) {
                    const versionString = args[3];
                    if (versionString === SERVER_VERSION) {
                        serverPid.push(pid);
                    } else {
                        const currentVersion = new ServerVersion(versionString);
                        if (currentVersion.isCompatible()) {
                            const desired = new ServerVersion(SERVER_VERSION);
                            if (desired.gt(currentVersion)) {
                                console.log(
                                    device.TAG,
                                    `Found older server version running (PID: ${pid}, Version: ${versionString})`,
                                );
                                console.log(device.TAG, 'Perform kill now');
                                device.killProcess(pid);
                            }
                        }
                    }
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

        const params = { tryCounter: 0, processExited: false };
        const runPromise = device.runShellCommandAdbKit(RUN_COMMAND);
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
                params.processExited = true;
            });
        list = await Promise.race([runPromise, this.waitForServerPid(device, params)]);
        if (Array.isArray(list) && list.length) {
            return list;
        }
        return;
    }
}
