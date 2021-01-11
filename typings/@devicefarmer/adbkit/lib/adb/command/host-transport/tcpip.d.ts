import Command from '../../command';
import Bluebird from 'bluebird';
declare class TcpIpCommand extends Command<number> {
    execute(port: number): Bluebird<number>;
}
export = TcpIpCommand;
