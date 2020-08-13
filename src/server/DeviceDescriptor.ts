import DescriptorFields from "../common/DescriptorFields";

export class DeviceDescriptor {
    public releaseVersion: string;
    public sdkVersion: string;
    public cpuAbi: string;
    public productManufacturer: string;
    public productModel: string;
    public wifiInterface: string;
    public udid: string;
    public state: string;
    public ip: string;
    public pid: number;

    constructor(fields: DescriptorFields) {
        this.releaseVersion = fields["build.version.release"];
        this.sdkVersion = fields["build.version.sdk"];
        this.cpuAbi = fields["ro.product.cpu.abi"];
        this.productManufacturer = fields["product.manufacturer"];
        this.productModel = fields["product.model"];
        this.wifiInterface = fields["wifi.interface"];
        this.udid = fields["udid"];
        this.state = fields["state"];
        this.ip = fields["ip"];
        this.pid = fields["pid"];
    }

    public toJSON(): DescriptorFields {
        return {
            "build.version.release": this.releaseVersion,
            "build.version.sdk": this.sdkVersion,
            "ro.product.cpu.abi": this.cpuAbi,
            "product.manufacturer": this.productManufacturer,
            "product.model": this.productModel,
            "wifi.interface": this.wifiInterface,
            udid: this.udid,
            state: this.state,
            ip: this.ip,
            pid: this.pid
        }
    }

    public equals(fields: DescriptorFields) {
        return !(
            this.udid !== fields["udid"] ||
            this.state !== fields["state"] ||
            this.ip !== fields["ip"] ||
            this.pid !== fields.pid ||
            this.releaseVersion !== fields["build.version.release"] ||
            this.sdkVersion !== fields["build.version.sdk"] ||
            this.cpuAbi !== fields["ro.product.cpu.abi"] ||
            this.productManufacturer !== fields["product.manufacturer"] ||
            this.productModel !== fields["product.model"] ||
            this.wifiInterface !== fields["wifi.interface"]);
    }
}
