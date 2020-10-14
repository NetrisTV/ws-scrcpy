import Command from '../../command';
import Bluebird from 'bluebird';
declare class RebootCommand extends Command<boolean> {
    execute(): Bluebird<boolean>;
}
export = RebootCommand;
