import { Message } from './Message';
import DroidDeviceDescriptor from './DroidDeviceDescriptor';

export interface MessageDroidDeviceList extends Message {
    type: 'devicelist';
    data: DroidDeviceDescriptor[];
}
