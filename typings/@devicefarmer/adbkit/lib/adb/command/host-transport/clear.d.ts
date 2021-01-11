import Command from '../../command';
import Bluebird from 'bluebird';
declare class ClearCommand extends Command<boolean> {
    execute(pkg: string): Bluebird<boolean>;
}
export = ClearCommand;
