import Command from '../../command';
import Bluebird from 'bluebird';
declare class GetPackagesCommand extends Command<string[]> {
    execute(): Bluebird<string[]>;
    private _parsePackages;
}
export = GetPackagesCommand;
