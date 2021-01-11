import Command from '../../command';
import Bluebird from 'bluebird';
declare class WaitBootCompleteCommand extends Command<boolean> {
    execute(): Bluebird<boolean>;
}
export = WaitBootCompleteCommand;
