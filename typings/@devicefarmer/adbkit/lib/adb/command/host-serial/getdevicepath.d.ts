import Command from '../../command';
import Bluebird from 'bluebird';
declare class GetDevicePathCommand extends Command<string> {
    execute(serial: string): Bluebird<string>;
}
export = GetDevicePathCommand;
