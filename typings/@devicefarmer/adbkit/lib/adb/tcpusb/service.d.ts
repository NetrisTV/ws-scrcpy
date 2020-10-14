/// <reference types="node" />
import { EventEmitter } from 'events';
import Packet from './packet';
import Bluebird from 'bluebird';
import Client from '../client';
import Socket from './socket';
declare class PrematurePacketError extends Error {
    packet: Packet;
    constructor(packet: Packet);
}
declare class LateTransportError extends Error {
    constructor();
}
declare class Service extends EventEmitter {
    private client;
    private serial;
    private localId;
    private remoteId;
    private socket;
    static PrematurePacketError: typeof PrematurePacketError;
    static LateTransportError: typeof LateTransportError;
    private opened;
    private ended;
    private transport;
    private needAck;
    constructor(client: Client, serial: string, localId: number, remoteId: number, socket: Socket);
    end(): Service;
    handle(packet: Packet): Bluebird<Service | boolean>;
    private _handleOpenPacket;
    private _handleOkayPacket;
    private _handleWritePacket;
    private _handleClosePacket;
    private _tryPush;
    private _readChunk;
}
export = Service;
