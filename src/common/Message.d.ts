import { XtermClientMessage } from './XtermMessage';
import DroidDeviceDescriptor from './DroidDeviceDescriptor';

export enum MessageTypes {
    'devicelist',
    'shell',
}

export interface Message {
    id: number;
    type: keyof typeof MessageTypes;
    data: DroidDeviceDescriptor[] | XtermClientMessage;
}
