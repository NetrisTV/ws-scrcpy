/// <reference types="node" />
import { EventEmitter } from 'events';
import Client from '../client';
import * as Net from 'net';
import { SocketOptions } from '../../SocketOptions';
declare class AuthError extends Error {
    constructor(message: string);
}
declare class UnauthorizedError extends Error {
    constructor();
}
declare class Socket extends EventEmitter {
    private readonly client;
    private readonly serial;
    private socket;
    private options;
    static AuthError: typeof AuthError;
    static UnauthorizedError: typeof UnauthorizedError;
    private ended;
    private reader;
    private authorized;
    private syncToken;
    private remoteId;
    private services;
    private remoteAddress?;
    private token;
    private signature;
    version: number;
    maxPayload: number;
    constructor(client: Client, serial: string, socket: Net.Socket, options?: SocketOptions);
    end(): Socket;
    private _error;
    private _handle;
    private _handleSyncPacket;
    private _handleConnectionPacket;
    private _handleAuthPacket;
    private _handleOpenPacket;
    private _forwardServicePacket;
    write(chunk: Buffer): boolean;
    private _createToken;
    private _skipNull;
    private _deviceId;
}
export = Socket;
