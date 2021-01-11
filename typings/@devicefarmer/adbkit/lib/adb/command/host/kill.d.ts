import Command from '../../command';
import Bluebird from 'bluebird';
declare class HostKillCommand extends Command<boolean> {
    execute(): Bluebird<boolean>;
}
export = HostKillCommand;
