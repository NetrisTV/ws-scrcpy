import DroidDeviceDescriptor from '../../types/DroidDeviceDescriptor';

export const Properties: ReadonlyArray<keyof DroidDeviceDescriptor> = [
    'ro.product.cpu.abi',
    'ro.product.manufacturer',
    'ro.product.model',
    'ro.build.version.release',
    'ro.build.version.sdk',
    'wifi.interface',
];
