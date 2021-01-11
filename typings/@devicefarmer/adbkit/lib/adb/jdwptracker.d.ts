/// <reference types="node" />
import { EventEmitter } from 'events';
import Bluebird from 'bluebird';
import Command from './command';
declare class JdwpTracker extends EventEmitter {
    private command;
    private pids;
    private pidMap;
    private reader;
    constructor(command: Command<JdwpTracker>);
    read(): Bluebird<JdwpTracker>;
    update(newList: string[]): JdwpTracker;
    end(): JdwpTracker;
}
export = JdwpTracker;
