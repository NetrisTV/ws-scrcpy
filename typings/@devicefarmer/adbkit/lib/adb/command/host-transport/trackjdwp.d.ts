import Bluebird from 'bluebird';
import Command from '../../command';
import JdwpTracker from '../../jdwptracker';
declare class TrackJdwpCommand extends Command<JdwpTracker> {
    execute(): Bluebird<JdwpTracker>;
}
export = TrackJdwpCommand;
