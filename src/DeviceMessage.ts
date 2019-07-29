import Util from './Util';

export default class DeviceMessage {
    public static TYPE_CLIPBOARD: number = 0;

    private static MAGIC: string = 'scrcpy';

    constructor(public readonly type: number, protected readonly buffer: Buffer) {
    }

    public static fromBuffer(data: ArrayBuffer): DeviceMessage {
        const buffer = Buffer.from(data, this.MAGIC.length, data.byteLength - this.MAGIC.length);
        const type = buffer.readUInt8(0);
        return new DeviceMessage(type, buffer);
    }

    public getText(): string {
        if (this.type !== DeviceMessage.TYPE_CLIPBOARD) {
            throw TypeError(`Wrong message type: ${this.type}`);
        }
        if (!this.buffer) {
            throw Error('Empty buffer');
        }
        let offset = 1;
        const length = this.buffer.readUInt16BE(offset);
        offset += 2;
        const textBytes = this.buffer.slice(offset, offset + length);
        return Util.utf8ByteArrayToString(textBytes);
    }

    public toString(): string {
        let desc: string;
        if (this.type === DeviceMessage.TYPE_CLIPBOARD && this.buffer) {
            desc = `, text=[${this.getText()}]`;
        } else {
            desc = this.buffer ? `, buffer=[${this.buffer.join(',')}]` : '';
        }
        return `DeviceMessage{type=${this.type}${desc}}`;
    }
}
