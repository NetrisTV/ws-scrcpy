/// <reference types="node" />
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import Parser from './parser';
import Bluebird from 'bluebird';
import { ClientOptions } from '../ClientOptions';
declare class Connection extends EventEmitter {
    options: ClientOptions;
    private socket;
    parser: Parser;
    private triedStarting;
    constructor(options: ClientOptions);
    connect(): Bluebird<Connection>;
    end(): Connection;
    write(data: string | Uint8Array, callback?: (err?: Error) => void): Connection;
    startServer(): Bluebird<ChildProcess>;
    private _exec;
}
export = Connection;
