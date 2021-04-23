import '../style/app.css';
import * as querystring from 'querystring';
import { StreamClientScrcpy } from './googDevice/client/StreamClientScrcpy';
import { ShellClient } from './googDevice/client/ShellClient';
import { ScrcpyStreamParams } from '../types/ScrcpyStreamParams';
import { ShellParams } from '../types/ShellParams';
import { DevtoolsClient } from './googDevice/client/DevtoolsClient';
import { DevtoolsParams } from '../types/DevtoolsParams';
import { BroadwayPlayer } from './player/BroadwayPlayer';
import { MsePlayer } from './player/MsePlayer';
import { TinyH264Player } from './player/TinyH264Player';
import { HostTracker } from './client/HostTracker';
import { StreamClientQVHack } from './applDevice/client/StreamClientQVHack';
import { QVHackStreamParams } from '../types/QVHackStreamParams';

window.onload = function (): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
    StreamClientScrcpy.registerPlayer(BroadwayPlayer);
    StreamClientScrcpy.registerPlayer(MsePlayer);
    StreamClientScrcpy.registerPlayer(TinyH264Player);

    if (action === StreamClientScrcpy.ACTION && typeof parsedQuery.udid === 'string') {
        StreamClientScrcpy.createFromParam(parsedQuery as ScrcpyStreamParams);
    } else if (action === StreamClientQVHack.ACTION && typeof parsedQuery.udid === 'string') {
        StreamClientQVHack.createFromParam(parsedQuery as QVHackStreamParams);
    } else if (action === ShellClient.ACTION && typeof parsedQuery.udid === 'string') {
        ShellClient.start(parsedQuery as ShellParams);
    } else if (action === DevtoolsClient.ACTION) {
        DevtoolsClient.start(parsedQuery as DevtoolsParams);
    } else {
        HostTracker.start();
    }
};
