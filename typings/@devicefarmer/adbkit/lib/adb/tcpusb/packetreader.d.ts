/// <reference types="node" />
import { EventEmitter } from 'events';
import Packet from './packet';
import ReadableStream = NodeJS.ReadableStream;
declare class ChecksumError extends Error {
    packet: Packet;
    constructor(packet: Packet);
}
declare class MagicError extends Error {
    packet: Packet;
    constructor(packet: Packet);
}
declare class PacketReader extends EventEmitter {
    private stream;
    static ChecksumError: typeof ChecksumError;
    static MagicError: typeof MagicError;
    private inBody;
    private buffer;
    private packet;
    constructor(stream: ReadableStream);
    private _tryRead;
    private _appendChunk;
    private _consume;
}
export = PacketReader;
