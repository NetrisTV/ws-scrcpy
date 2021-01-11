import HostDevicesCommand from './devices';
import Bluebird from 'bluebird';
declare class HostTrackDevicesCommand extends HostDevicesCommand {
    execute(): Bluebird<any>;
}
export = HostTrackDevicesCommand;
