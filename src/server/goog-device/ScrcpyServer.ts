import '../../../vendor/Genymobile/scrcpy/scrcpy-server.jar';
import '../../../vendor/Genymobile/scrcpy/LICENSE';

import { Device } from './Device';
import { ARGS_STRING, SERVER_PACKAGE, SERVER_PROCESS_NAME, SERVER_VERSION } from '../../common/Constants';
import path from 'path';
import PushTransfer from '@dead50f7/adbkit/lib/adb/sync/pushtransfer';
import { ServerVersion } from './ServerVersion';

const TEMP_PATH = '/data/local/tmp/';
const FILE_DIR = path.join(__dirname, 'vendor/Genymobile/scrcpy');
const FILE_NAME = 'scrcpy-server.jar';
const RUN_COMMAND = `CLASSPATH=${TEMP_PATH}${FILE_NAME} nohup app_process ${ARGS_STRING}`;

type WaitForPidParams = { tryCounter: number; processExited: boolean; lookPidFile: boolean };

export class ScrcpyServer {
    private static PID_FILE_PATH = '/data/local/tmp/ws_scrcpy.pid';
    private static async copyServer(device: Device): Promise<PushTransfer> {
        const src = path.join(FILE_DIR, FILE_NAME);
        const dst = TEMP_PATH + FILE_NAME; // don't use path.join(): will not work on win host
        return device.push(src, dst);
    }

    // Important to notice that we first try to read PID from file.
    // Checking with `.getServerPid()` will return process id, but process may stop.
    // PID file only created after WebSocket server has been successfully started.
    private static async waitForServerPid(device: Device, params: WaitForPidParams): Promise<number[] | undefined> {
        const { tryCounter, processExited, lookPidFile } = params;
        if (processExited) {
            return;
        }
        const timeout = 500 + 100 * tryCounter;
        if (lookPidFile) {
            const fileName = ScrcpyServer.PID_FILE_PATH;
            const content = await device.runShellCommandAdbKit(`test -f ${fileName} && cat ${fileName}`);
            if (content.trim()) {
                const pid = parseInt(content, 10);
                if (pid && !isNaN(pid)) {
                    const realPid = await this.getServerPid(device);
                    if (realPid?.includes(pid)) {
                        return realPid;
                    } else {
                        params.lookPidFile = false;
                    }
                }
            }
        } else {
            const list = await this.getServerPid(device);
            if (Array.isArray(list) && list.length) {
                return list;
            }
        }
        if (++params.tryCounter > 5) {
            throw new Error('Failed to start server');
        }
        return new Promise<number[] | undefined>((resolve) => {
            setTimeout(() => {
                resolve(this.waitForServerPid(device, params));
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
                if (args.length < 3) {
                    return;
                }
                const versionString = args[1];
                if (versionString === SERVER_VERSION) {
                    serverPid.push(pid);
                } else {
                    const currentVersion = new ServerVersion(versionString);
                    if (currentVersion.isCompatible()) {
                        const desired = new ServerVersion(SERVER_VERSION);
                        if (desired.gt(currentVersion)) {
                            console.log(
                                device.TAG,
                                `Found old server version running (PID: ${pid}, Version: ${versionString})`,
                            );
                            console.log(device.TAG, 'Perform kill now');
                            device.killProcess(pid);
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

        const params: WaitForPidParams = { tryCounter: 0, processExited: false, lookPidFile: true };
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
                params.processExited = true;
            });
        list = await Promise.race([runPromise, this.waitForServerPid(device, params)]);
        if (Array.isArray(list) && list.length) {
            return list;
        }
        return;
    }
}
