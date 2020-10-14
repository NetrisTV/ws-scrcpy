import Command from '../../command';
import { Reverse } from '../../../Reverse';
import Bluebird from 'bluebird';
declare class ListReversesCommand extends Command<Reverse[]> {
    execute(): Bluebird<Reverse[]>;
    private _parseReverses;
}
export = ListReversesCommand;
