/// <reference types="node" />
import Command from '../../command';
import Bluebird from 'bluebird';
import { Duplex } from 'stream';
declare class ScreencapCommand extends Command<Duplex> {
    execute(): Bluebird<Duplex>;
}
export = ScreencapCommand;
