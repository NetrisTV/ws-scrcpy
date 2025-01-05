export const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
export const SERVER_PORT = 8886;
export const SERVER_VERSION = '1.19-ws6';

export const SERVER_TYPE = 'web';

export const LOG_LEVEL = 'ERROR';

let SCRCPY_LISTENS_ON_ALL_INTERFACES;
/// #if SCRCPY_LISTENS_ON_ALL_INTERFACES
SCRCPY_LISTENS_ON_ALL_INTERFACES = true;
/// #else
SCRCPY_LISTENS_ON_ALL_INTERFACES = false;
/// #endif

const ARGUMENTS = [SERVER_VERSION, SERVER_TYPE, LOG_LEVEL, SERVER_PORT, SCRCPY_LISTENS_ON_ALL_INTERFACES];

export const SERVER_PROCESS_NAME = 'app_process';

export const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(' ')} 2>&1 > /dev/null`;
