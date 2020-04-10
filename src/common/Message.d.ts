import { Device } from './Device';
import { LogcatClientMessage, LogcatServiceMessage } from './LogcatMessage';

export enum MessageTypes {
    'devicelist',
    'logcat'
}

export interface Message {
    id: number;
    type: keyof typeof MessageTypes;
    data: Device[] | LogcatServiceMessage | LogcatClientMessage;
}
