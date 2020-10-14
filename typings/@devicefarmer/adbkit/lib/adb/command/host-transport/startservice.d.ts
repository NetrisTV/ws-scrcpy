import StartActivityCommand from './startactivity';
import { StartServiceOptions } from '../../../StartServiceOptions';
import Bluebird from 'bluebird';
declare class StartServiceCommand extends StartActivityCommand {
    execute(options: StartServiceOptions): Bluebird<boolean>;
}
export = StartServiceCommand;
