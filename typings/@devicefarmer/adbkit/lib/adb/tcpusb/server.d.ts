/// <reference types="node" />
import * as Net from 'net';
import { EventEmitter } from 'events';
import Client from '../client';
import { SocketOptions } from '../../SocketOptions';
declare type NetServer = Net.Server;
declare class Server extends EventEmitter {
    private readonly client;
    private readonly serial;
    private readonly options;
    private readonly server;
    private connections;
    constructor(client: Client, serial: string, options: SocketOptions);
    listen(...args: Parameters<NetServer['listen']>): Server;
    close(): Server;
    end(): Server;
}
export = Server;
