export const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
export const SERVER_VERSION = '3.1';
export const SCRCPY_SOCKET_NAME = 'scrcpy_00000000';

const ARGUMENTS = [
    SERVER_VERSION,
    'scid=0',
    'log_level=verbose',
    'audio=true',
    'audio_codec=opus',
    'audio_bit_rate=128000',
    'tunnel_forward=true',
    'max_size=1920',
    'control=false',
];

export const SERVER_PROCESS_NAME = 'app_process';
// Note: output NOT redirected to /dev/null during debugging so we can see exit reason
export const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(' ')} 2>&1`;
