import Command from '../../command';
import Bluebird from 'bluebird';
declare class HostTransportCommand extends Command<boolean> {
    execute(serial: string): Bluebird<boolean>;
}
export = HostTransportCommand;
