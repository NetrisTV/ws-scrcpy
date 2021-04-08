import * as readline from 'readline';
import { HttpServer } from './services/HttpServer';
import { WebSocketServer } from './services/WebSocketServer';
import { Service, ServiceClass } from './services/Service';
import { AndroidControlCenter } from './services/AndroidControlCenter';
import { DeviceTracker } from './mw/DeviceTracker';
import { MwFactory } from './mw/Mw';
import { RemoteShell } from './mw/RemoteShell';
import { WebsocketProxy } from './mw/WebsocketProxy';
import { RemoteDevtools } from './mw/RemoteDevtools';
import { Config } from './Config';
import { HostTracker } from './mw/HostTracker';
import { defaultAndroidHostConfiguration } from './default/AndroidHostConfiguration';

const config = Config.getInstance(defaultAndroidHostConfiguration);
const servicesToStart: ServiceClass[] = [HttpServer, WebSocketServer];
const mwList: MwFactory[] = [HostTracker, WebsocketProxy];

if (config.isLocalAndroidTrackerEnabled()) {
    servicesToStart.push(AndroidControlCenter);

    mwList.push(DeviceTracker);
    mwList.push(RemoteShell);
    mwList.push(RemoteDevtools);
}

const runningServices: Service[] = [];

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
