import * as querystring from 'querystring';
import { ClientDeviceTracker } from './client/ClientDeviceTracker';
import { ClientLogsProxy, LogsParams } from './client/ClientLogsProxy';
import { ClientStream, StreamParams } from './client/ClientStream';

window.onload = function(): void {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;
    if (action === ClientLogsProxy.ACTION && typeof parsedQuery.udid === 'string') {
        ClientLogsProxy.start(parsedQuery as LogsParams);
    } else if (action === ClientStream.ACTION && typeof parsedQuery.udid === 'string') {
        ClientStream.start(parsedQuery as StreamParams);
    } else {
        ClientDeviceTracker.start();
    }
};
