import { Message } from './Message';
import QVHackDeviceDescriptor from './QVHackDeviceDescriptor';

export interface MessageQVHackDeviceList extends Message {
    type: 'qvhack-device-list';
    data: QVHackDeviceDescriptor[];
}
