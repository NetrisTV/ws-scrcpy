import Command from '../../command';
import Bluebird from 'bluebird';
declare class GetSerialNoCommand extends Command<string> {
    execute(serial: string): Bluebird<string>;
}
export = GetSerialNoCommand;
