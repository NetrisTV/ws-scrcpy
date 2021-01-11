import Command from '../../command';
import Bluebird from 'bluebird';
declare class ReverseCommand extends Command<boolean> {
    execute(remote: string, local: string): Bluebird<boolean>;
}
export = ReverseCommand;
