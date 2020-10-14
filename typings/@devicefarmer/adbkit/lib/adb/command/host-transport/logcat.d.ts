import LineTransform from '../../linetransform';
import Command from '../../command';
import * as Bluebird from 'bluebird';
declare class LogcatCommand extends Command<any> {
    execute(options?: {
        clear?: boolean;
    }): Bluebird<LineTransform>;
}
export = LogcatCommand;
