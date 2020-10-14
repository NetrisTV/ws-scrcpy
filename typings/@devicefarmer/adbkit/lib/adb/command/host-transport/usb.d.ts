import Command from '../../command';
import Bluebird from 'bluebird';
declare class UsbCommand extends Command<boolean> {
    execute(): Bluebird<boolean>;
}
export = UsbCommand;
