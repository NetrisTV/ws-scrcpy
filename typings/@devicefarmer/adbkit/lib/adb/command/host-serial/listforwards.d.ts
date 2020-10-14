import Command from '../../command';
import { Forward } from '../../../Forward';
import Bluebird from 'bluebird';
declare class ListForwardsCommand extends Command<Forward[]> {
    execute(serial: string): Bluebird<Forward[]>;
    private _parseForwards;
}
export = ListForwardsCommand;
