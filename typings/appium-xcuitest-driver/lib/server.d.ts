import { server as baseServer } from 'appium-base-driver';
import { XCUITestDriver } from './driver';

export class Server extends baseServer {
    public driver: XCUITestDriver;
}

export function startServer(port: string | number, address?: string): Server;
