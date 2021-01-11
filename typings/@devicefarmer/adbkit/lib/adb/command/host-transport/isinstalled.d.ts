import Command from '../../command';
import Bluebird from 'bluebird';
declare class IsInstalledCommand extends Command<boolean> {
    execute(pkg: string): Bluebird<boolean>;
}
export = IsInstalledCommand;
