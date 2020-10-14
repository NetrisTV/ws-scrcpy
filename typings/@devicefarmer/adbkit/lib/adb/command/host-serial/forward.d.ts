import Command from '../../command';
import Bluebird from 'bluebird';
declare class ForwardCommand extends Command<boolean> {
    execute(serial: string, local: string, remote: string): Bluebird<boolean>;
}
export = ForwardCommand;
