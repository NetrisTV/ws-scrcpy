import { XtermClientMessage } from './XtermMessage';
import DescriptorFields from "./DescriptorFields";

export enum MessageTypes {
    'devicelist',
    'shell',
}

export interface Message {
    id: number;
    type: keyof typeof MessageTypes;
    data: DescriptorFields[] | XtermClientMessage;
}
