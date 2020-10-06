import { NetInterface } from './NetInterface';

export default interface DroidDeviceDescriptor {
    'build.version.release': string;
    'build.version.sdk': string;
    'ro.product.cpu.abi': string;
    'product.manufacturer': string;
    'product.model': string;
    'wifi.interface': string;
    interfaces: NetInterface[];
    udid: string;
    state: string;
    pid: number;
}
