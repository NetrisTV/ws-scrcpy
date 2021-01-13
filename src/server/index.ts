import * as readline from 'readline';
import { HttpServer } from './services/HttpServer';
import { WebSocketServer } from './services/WebSocketServer';
import { Service, ServiceClass } from './services/Service';
import { AndroidDeviceTracker } from './services/AndroidDeviceTracker';
import { DeviceTracker } from './mw/DeviceTracker';
import { MwFactory } from './mw/Mw';
import { RemoteShell } from './mw/RemoteShell';
import { WebsocketProxy } from './mw/WebsocketProxy';
import { RemoteDevtools } from './mw/RemoteDevtools';

const servicesToStart: ServiceClass[] = [HttpServer, WebSocketServer, AndroidDeviceTracker];
const runningServices: Service[] = [];

servicesToStart.forEach((serviceClass: ServiceClass) => {
    const service = serviceClass.getInstance();
    runningServices.push(service);
    service.start();
});

const mwList: MwFactory[] = [DeviceTracker, RemoteShell, WebsocketProxy, RemoteDevtools];
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
