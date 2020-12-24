import { BaseDeviceDescriptor } from './BaseDeviceDescriptor';

export default interface QVHackDeviceDescriptor extends BaseDeviceDescriptor {
    ProductName: string;
    ProductType: string;
    // FIXME: replace with `udid`
    Udid: string;
    ProductVersion: string;
}
