import Command from '../../command';
import Bluebird from 'bluebird';
declare class UninstallCommand extends Command<boolean> {
    execute(pkg: string): Bluebird<boolean>;
}
export = UninstallCommand;
