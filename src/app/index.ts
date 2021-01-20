import '../style/app.css';
import * as querystring from 'querystring';
import { StreamClientScrcpy } from './client/StreamClientScrcpy';
import { ShellClient } from './client/ShellClient';
import { ScrcpyStreamParams } from '../common/ScrcpyStreamParams';
import { ShellParams } from '../common/ShellParams';
import { DevtoolsClient } from './client/DevtoolsClient';
import { DevtoolsParams } from '../common/DevtoolsParams';
import { DeviceTrackerDroid } from './client/DeviceTrackerDroid';
import { BroadwayPlayer } from './player/BroadwayPlayer';
import { MsePlayer } from './player/MsePlayer';
import { TinyH264Player } from './player/TinyH264Player';

window.onload = function (): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
    StreamClientScrcpy.registerPlayer(BroadwayPlayer);
    StreamClientScrcpy.registerPlayer(MsePlayer);
    StreamClientScrcpy.registerPlayer(TinyH264Player);

    if (action === StreamClientScrcpy.ACTION && typeof parsedQuery.udid === 'string') {
        new StreamClientScrcpy(parsedQuery as ScrcpyStreamParams);
    } else if (action === ShellClient.ACTION && typeof parsedQuery.udid === 'string') {
        ShellClient.start(parsedQuery as ShellParams);
    } else if (action === DevtoolsClient.ACTION) {
        DevtoolsClient.start(parsedQuery as DevtoolsParams);
    } else {
        DeviceTrackerDroid.start();
    }
};
