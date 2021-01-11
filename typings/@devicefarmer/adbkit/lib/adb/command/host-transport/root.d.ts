import Command from '../../command';
import Bluebird from 'bluebird';
declare class RootCommand extends Command<boolean> {
    execute(): Bluebird<boolean>;
}
export = RootCommand;
