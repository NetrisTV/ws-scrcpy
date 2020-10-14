/// <reference types="node" />
import Command from '../../command';
import { Duplex } from 'stream';
import Bluebird from 'bluebird';
declare class LogCommand extends Command<Duplex> {
    execute(name: string): Bluebird<Duplex>;
}
export = LogCommand;
