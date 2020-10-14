import Command from '../../command';
import Bluebird from 'bluebird';
declare class GetStateCommand extends Command<string> {
    execute(serial: string): Bluebird<string>;
}
export = GetStateCommand;
