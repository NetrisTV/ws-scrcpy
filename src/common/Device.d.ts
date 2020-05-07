export interface Device {
    'build.version.release': string;
    'build.version.sdk': string;
    'ro.product.cpu.abi': string;
    'product.manufacturer': string;
    'product.model': string;
    udid: string;
    state: string;
    ip: string;
    pid: number;
}
