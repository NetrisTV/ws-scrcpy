import Command from '../../command';
import Bluebird from 'bluebird';
declare class InstallCommand extends Command<boolean> {
    execute(apk: string): Bluebird<boolean>;
}
export = InstallCommand;
