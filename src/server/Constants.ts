export const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
export const SERVER_PORT = 8886;
export const SERVER_VERSION = '1.17-ws1';

export const SERVER_TYPE = 'web';

const ARGUMENTS = [SERVER_VERSION, SERVER_TYPE, SERVER_PORT];

export const SERVER_PROCESS_NAME = 'app_process';

export const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(' ')} 2>&1 > /dev/null`;

export enum ACTION {
    DEVICE_LIST = 'droid-device-list',
    SHELL = 'shell',
    PROXY = 'proxy',
    DEVTOOLS = 'devtools',
}
