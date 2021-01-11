/// <reference types="node" />
import Bluebird from 'bluebird';
import Command from '../../command';
import { Duplex } from 'stream';
declare class MonkeyCommand extends Command<Duplex> {
    execute(port: number): Bluebird<Duplex>;
}
export = MonkeyCommand;
