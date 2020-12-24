export const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
export const SERVER_PORT = 8886;
export const SERVER_VERSION = '1.16-ws1';

const LOG_LEVEL = 'ERROR';
const MAX_SIZE = 0;
const BITRATE = 8000000;
const MAX_FPS = 60;
const LOCKED_SCREEN_ORIENTATION = -1;
const TUNNEL_FORWARD = false;
const CROP = '-';
const SEND_META_FRAME = false;
const CONTROL = true; // If control is enabled, synchronize Android clipboard to the computer automatically
const DISPLAY_ID = 0;
const SHOW_TOUCHES = false;
const STAY_AWAKE = false;
const CODEC_OPTIONS = '-';
const SERVER_TYPE = 'web';

const ARGUMENTS = [
    SERVER_VERSION,
    LOG_LEVEL,
    MAX_SIZE,
    BITRATE,
    MAX_FPS,
    LOCKED_SCREEN_ORIENTATION,
    TUNNEL_FORWARD,
    CROP,
    SEND_META_FRAME,
    CONTROL,
    DISPLAY_ID,
    SHOW_TOUCHES,
    STAY_AWAKE,
    CODEC_OPTIONS,
    SERVER_TYPE,
    SERVER_PORT,
];

export const SERVER_PROCESS_NAME = 'app_process';

export const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(' ')} 2>&1 > /dev/null`;

export enum ACTION {
    DEVICE_LIST = 'droid-device-list',
    SHELL = 'shell',
    PROXY = 'proxy',
    DEVTOOLS = 'devtools',
}
