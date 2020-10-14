/// <reference types="node" />
import Command from '../../command';
import { Duplex } from 'stream';
import Bluebird from 'bluebird';
declare class LocalCommand extends Command<Duplex> {
    execute(path: string): Bluebird<Duplex>;
}
export = LocalCommand;
