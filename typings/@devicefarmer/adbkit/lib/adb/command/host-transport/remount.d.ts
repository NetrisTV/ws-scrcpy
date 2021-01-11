import Command from '../../command';
import Bluebird from 'bluebird';
declare class RemountCommand extends Command<boolean> {
    execute(): Bluebird<boolean>;
}
export = RemountCommand;
