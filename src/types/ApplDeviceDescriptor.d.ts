import { BaseDeviceDescriptor } from './BaseDeviceDescriptor';

export default interface ApplDeviceDescriptor extends BaseDeviceDescriptor {
    name: string;
    model: string;
    version: string;
    'last.update.timestamp': number;
}
