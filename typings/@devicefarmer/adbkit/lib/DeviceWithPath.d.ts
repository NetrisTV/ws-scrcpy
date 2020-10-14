import { Device } from './Device';
export interface DeviceWithPath extends Device {
    path: string;
    product: string;
    model: string;
    device: string;
    transportId: string;
}
