/// <reference types="node" />
import Connection from './connection';
import Protocol from './protocol';
import Parser from './parser';
import Bluebird from 'bluebird';
import { WithToString } from '../WithToString';
declare abstract class Command<T> {
    parser: Parser;
    protocol: Protocol;
    connection: Connection;
    constructor(connection: Connection);
    abstract execute(...args: any): Bluebird<T>;
    _send(data: string | Buffer): Command<T>;
    _escape(arg: number | WithToString): number | string;
    _escapeCompat(arg: number | WithToString): number | string;
}
export = Command;
