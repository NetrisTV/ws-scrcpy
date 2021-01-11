/// <reference types="node" />
import Bluebird from 'bluebird';
import { EventEmitter } from 'events';
import Stats from './sync/stats';
import Entry from './sync/entry';
import PushTransfer from './sync/pushtransfer';
import PullTransfer from './sync/pulltransfer';
import Connection from './connection';
import { Callback } from '../Callback';
import { ReadStream } from 'fs';
declare class Sync extends EventEmitter {
    private connection;
    private parser;
    static temp(path: string): string;
    constructor(connection: Connection);
    stat(path: string, callback?: Callback<Stats>): Bluebird<Stats>;
    readdir(path: string, callback?: Callback<Entry[]>): Bluebird<Entry[]>;
    push(contents: string | ReadStream, path: string, mode: number): PushTransfer;
    pushFile(file: string, path: string, mode?: number): PushTransfer;
    pushStream(stream: ReadStream, path: string, mode?: number): PushTransfer;
    pull(path: string): PullTransfer;
    end(): Sync;
    tempFile(path: string): string;
    private _writeData;
    private _readData;
    private _readError;
    private _sendCommandWithLength;
    private _sendCommandWithArg;
    private _enoent;
}
export = Sync;
