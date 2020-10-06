import DroidDeviceDescriptor from '../common/DroidDeviceDescriptor';
import { NetInterface } from '../common/NetInterface';

export class DeviceDescriptor {
    public releaseVersion: string;
    public sdkVersion: string;
    public cpuAbi: string;
    public productManufacturer: string;
    public productModel: string;
    public wifiInterface: string;
    public udid: string;
    public state: string;
    public interfaces: NetInterface[];
    public pid: number;

    constructor(fields: DroidDeviceDescriptor) {
        this.releaseVersion = fields['build.version.release'];
        this.sdkVersion = fields['build.version.sdk'];
        this.cpuAbi = fields['ro.product.cpu.abi'];
        this.productManufacturer = fields['product.manufacturer'];
        this.productModel = fields['product.model'];
        this.wifiInterface = fields['wifi.interface'];
        this.udid = fields['udid'];
        this.state = fields['state'];
        this.interfaces = fields['interfaces'].sort(DeviceDescriptor.sortInterfaces);
        this.pid = fields['pid'];
    }

    private static sortInterfaces(a: NetInterface, b: NetInterface): 1 | -1 | 0 {
        if (a.name > b.name) {
            return 1;
        } else if (a.name < b.name) {
            return -1;
        }
        return 0;
    }

    public toJSON(): DroidDeviceDescriptor {
        return {
            'build.version.release': this.releaseVersion,
            'build.version.sdk': this.sdkVersion,
            'ro.product.cpu.abi': this.cpuAbi,
            'product.manufacturer': this.productManufacturer,
            'product.model': this.productModel,
            'wifi.interface': this.wifiInterface,
            udid: this.udid,
            state: this.state,
            interfaces: this.interfaces,
            pid: this.pid,
        };
    }

    public equals(fields: DroidDeviceDescriptor): boolean {
        const simpleFieldsAreEqual = (
            this.udid === fields['udid'] ||
            this.state === fields['state'] ||
            this.pid === fields.pid ||
            this.releaseVersion === fields['build.version.release'] ||
            this.sdkVersion === fields['build.version.sdk'] ||
            this.cpuAbi === fields['ro.product.cpu.abi'] ||
            this.productManufacturer === fields['product.manufacturer'] ||
            this.productModel === fields['product.model'] ||
            this.wifiInterface === fields['wifi.interface']
        );
        if (!simpleFieldsAreEqual) {
            return simpleFieldsAreEqual;
        }
        if (this.interfaces.length !== fields.interfaces.length) {
            return false;
        }
        const sortedInterfaces = fields.interfaces.sort(DeviceDescriptor.sortInterfaces);
        for (let i = 0, l = this.interfaces.length; i < l; i++) {
            const a = this.interfaces[i];
            const b = sortedInterfaces[i]
            if (a.name !== b.name || a.ipv4 !== b.ipv4) {
                return false;
            }
        }
        return true;
    }
}
