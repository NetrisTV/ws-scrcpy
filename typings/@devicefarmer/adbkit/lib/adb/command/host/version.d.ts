import Command from '../../command';
import Bluebird from 'bluebird';
declare class HostVersionCommand extends Command<number> {
    execute(): Bluebird<number>;
    _parseVersion(version: string): number;
}
export = HostVersionCommand;
