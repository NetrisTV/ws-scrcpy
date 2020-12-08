import '../style/app.css';
import * as querystring from 'querystring';
import { StreamClientScrcpy } from './client/StreamClientScrcpy';
import { ShellClient } from './client/ShellClient';
import { ScrcpyStreamParams } from '../common/ScrcpyStreamParams';
import { ShellParams } from '../common/ShellParams';
import { DevtoolsClient } from './client/DevtoolsClient';
import { DevtoolsParams } from '../common/DevtoolsParams';
import { DeviceTrackerDroid } from './client/DeviceTrackerDroid';

window.onload = function (): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
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
