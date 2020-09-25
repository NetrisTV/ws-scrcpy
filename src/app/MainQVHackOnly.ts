import '../style/app.css';
import * as querystring from 'querystring';
import { QVHackClientDeviceTracker } from './client/QVHackClientDeviceTracker';
import { QVHackStreamClient } from './client/QVHackStreamClient';
import { QVHackStreamParams } from '../common/QVHackStreamParams';

window.onload = function (): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
    if (action === QVHackStreamClient.ACTION && typeof parsedQuery.udid === 'string') {
        new QVHackStreamClient(parsedQuery as QVHackStreamParams);
    } else {
        QVHackClientDeviceTracker.start();
    }
};
