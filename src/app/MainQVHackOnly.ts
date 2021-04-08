import '../style/app.css';
import * as querystring from 'querystring';
import { DeviceTrackerQVHack } from './client/DeviceTrackerQVHack';
import { StreamClientQVHack } from './client/StreamClientQVHack';
import { QVHackStreamParams } from '../types/QVHackStreamParams';

window.onload = function (): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
    if (action === StreamClientQVHack.ACTION && typeof parsedQuery.udid === 'string') {
        new StreamClientQVHack(parsedQuery as QVHackStreamParams);
    } else {
        DeviceTrackerQVHack.start();
    }
};
