/// <reference types="node" />
import Command from '../../command';
import { Duplex } from 'stream';
import Bluebird from 'bluebird';
import { WithToString } from '../../../WithToString';
declare class ShellCommand extends Command<Duplex> {
    execute(command: string | ArrayLike<WithToString>): Bluebird<Duplex>;
}
export = ShellCommand;
