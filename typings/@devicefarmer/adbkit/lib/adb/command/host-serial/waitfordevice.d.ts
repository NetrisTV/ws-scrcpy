import Command from '../../command';
import Bluebird from 'bluebird';
declare class WaitForDeviceCommand extends Command<string> {
    execute(serial: string): Bluebird<string>;
}
export = WaitForDeviceCommand;
