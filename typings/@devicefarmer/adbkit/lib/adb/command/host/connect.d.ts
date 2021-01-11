import Command from '../../command';
import Bluebird from 'bluebird';
declare class ConnectCommand extends Command<string> {
    execute(host: string, port: number): Bluebird<string>;
}
export = ConnectCommand;
