import Command from '../../command';
import { StartActivityOptions } from '../../../StartActivityOptions';
import Bluebird from 'bluebird';
declare class StartActivityCommand extends Command<boolean> {
    execute(options: StartActivityOptions): Bluebird<boolean>;
    _run(command: string, args: Array<string | number>): Bluebird<boolean>;
    protected _intentArgs(options: StartActivityOptions): Array<string | number>;
    private _formatExtras;
    private _formatShortExtra;
    private _formatLongExtra;
}
export = StartActivityCommand;
