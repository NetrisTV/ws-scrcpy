import '../style/app.css';
import * as querystring from 'querystring';
import { ScrcpyClient, StreamParams } from './client/ScrcpyClient';
import { ShellParams, ShellClient } from './client/ShellClient';
import { DroidDeviceTrackerClient } from './client/DroidDeviceTrackerClient';

window.onload = function (): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
    if (action === ScrcpyClient.ACTION && typeof parsedQuery.udid === 'string') {
        ScrcpyClient.start(parsedQuery as StreamParams);
    } else if (action === ShellClient.ACTION && typeof parsedQuery.udid === 'string') {
        ShellClient.start(parsedQuery as ShellParams);
    } else {
        DroidDeviceTrackerClient.start();
    }
};
