/// <reference types="node" />
import Command from '../../command';
import { Duplex } from 'stream';
import Bluebird from 'bluebird';
declare class TcpCommand extends Command<Duplex> {
    execute(port: number, host?: string): Bluebird<Duplex>;
}
export = TcpCommand;
