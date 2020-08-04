import { Device } from './Device';
import { LogcatClientMessage, LogcatServiceMessage } from 'adbkit/LogcatMessage';
import { XtermClientMessage } from './XtermMessage';

export enum MessageTypes {
    'devicelist',
    'logcat',
    'shell',
}

export interface Message {
    id: number;
    type: keyof typeof MessageTypes;
    data: Device[] | LogcatServiceMessage | LogcatClientMessage | XtermClientMessage;
}
