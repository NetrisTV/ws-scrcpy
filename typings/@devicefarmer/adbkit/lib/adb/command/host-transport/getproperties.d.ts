import Command from '../../command';
import * as Bluebird from 'bluebird';
import { Properties } from '../../../Properties';
declare class GetPropertiesCommand extends Command<any> {
    execute(): Bluebird<Properties>;
    private _parseProperties;
}
export = GetPropertiesCommand;
