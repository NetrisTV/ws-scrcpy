import { Server as HttpServer } from 'http';

import { XCUITestDriver } from './driver';

export class Server extends HttpServer {
    public driver: XCUITestDriver;
}

export function startServer(port: string | number, address?: string): Server;
