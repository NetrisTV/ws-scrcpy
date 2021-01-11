import Sync from '../../sync';
import Command from '../../command';
import Bluebird from 'bluebird';
declare class SyncCommand extends Command<Sync> {
    execute(): Bluebird<Sync>;
}
export = SyncCommand;
