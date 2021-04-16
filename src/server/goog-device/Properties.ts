import GoogDeviceDescriptor from '../../types/GoogDeviceDescriptor';

export const Properties: ReadonlyArray<keyof GoogDeviceDescriptor> = [
    'ro.product.cpu.abi',
    'ro.product.manufacturer',
    'ro.product.model',
    'ro.build.version.release',
    'ro.build.version.sdk',
    'wifi.interface',
];
