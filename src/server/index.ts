import * as readline from 'readline';
import { HttpServer } from './services/HttpServer';
import { WebSocketServer } from './services/WebSocketServer';
import { Service, ServiceClass } from './services/Service';
import { MwFactory } from './mw/Mw';
import { WebsocketProxy } from './mw/WebsocketProxy';
import { HostTracker } from './mw/HostTracker';

const servicesToStart: ServiceClass[] = [HttpServer, WebSocketServer];
const mwList: MwFactory[] = [HostTracker, WebsocketProxy];

const runningServices: Service[] = [];
const loadPlatformModulesPromises: Promise<void>[] = [];

/// #if INCLUDE_GOOG
async function loadGoogModules() {
    const { ControlCenter } = await import('./goog-device/services/ControlCenter');
    const { DeviceTracker } = await import('./goog-device/mw/DeviceTracker');
    const { RemoteShell } = await import('./goog-device/mw/RemoteShell');
    const { RemoteDevtools } = await import('./goog-device/mw/RemoteDevtools');
    const { WebsocketProxyOverAdb } = await import('./goog-device/mw/WebsocketProxyOverAdb');

    HostTracker.registerLocalTracker(DeviceTracker);

    servicesToStart.push(ControlCenter);

    mwList.push(DeviceTracker);
    mwList.push(RemoteShell);
    mwList.push(RemoteDevtools);
    mwList.push(WebsocketProxyOverAdb);
}
loadPlatformModulesPromises.push(loadGoogModules());
/// #endif

/// #if INCLUDE_APPL
async function loadApplModules() {
    const { ControlCenter } = await import('./appl-device/services/ControlCenter');
    const { DeviceTracker } = await import('./appl-device/mw/DeviceTracker');
    const { StreamProxy } = await import('./appl-device/mw/StreamProxy');
    const { WebDriverAgentProxy } = await import('./appl-device/mw/WebDriverAgentProxy');

    // Hack to reduce log-level of appium libs
    const npmlog = await import('npmlog');
    npmlog.level = 'warn';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any)._global_npmlog = npmlog;

    HostTracker.registerLocalTracker(DeviceTracker);

    servicesToStart.push(ControlCenter);

    mwList.push(DeviceTracker);
    mwList.push(StreamProxy);
    mwList.push(WebDriverAgentProxy);
}
loadPlatformModulesPromises.push(loadApplModules());
/// #endif

Promise.all(loadPlatformModulesPromises).then(() => {
    servicesToStart.forEach((serviceClass: ServiceClass) => {
        const service = serviceClass.getInstance();
        runningServices.push(service);
        service.start();
    });

    const wsService = WebSocketServer.getInstance();
    mwList.forEach((mwFactory: MwFactory) => {
        wsService.registerMw(mwFactory);
    });

    if (process.platform === 'win32') {
        readline
            .createInterface({
                input: process.stdin,
                output: process.stdout,
            })
            .on('SIGINT', exit);
    }

    process.on('SIGINT', exit);
    process.on('SIGTERM', exit);
});

let interrupted = false;
function exit(signal: string) {
    console.log(`\nReceived signal ${signal}`);
    if (interrupted) {
        console.log('Force exit');
        process.exit(0);
        return;
    }
    interrupted = true;
    runningServices.forEach((service: Service) => {
        const serviceName = service.getName();
        console.log(`Stopping ${serviceName} ...`);
        service.release();
    });
}
