import ControlMessage from './ControlMessage';
import Position from '../Position';

export default class TouchControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 28;

    constructor(
        readonly action: number,
        readonly pointerId: number,
        readonly position: Position,
        readonly pressure: number,
        readonly buttons: number,
    ) {
        super(ControlMessage.TYPE_MOUSE);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer: Buffer = new Buffer(TouchControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;
        offset = buffer.writeUInt8(this.type, offset);
        offset = buffer.writeUInt8(this.action, offset);
        offset = buffer.writeUInt32BE(0, offset); // pointerId is `long` (8 bytes) on java side
        offset = buffer.writeUInt32BE(this.pointerId, offset);
        offset = buffer.writeUInt32BE(this.position.point.x, offset);
        offset = buffer.writeUInt32BE(this.position.point.y, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.width, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.height, offset);
        offset = buffer.writeUInt16BE(this.pressure, offset);
        buffer.writeUInt32BE(this.buttons, offset);
        return buffer;
    }

    public toString(): string {
        return `TouchControlMessage{action=${this.action}, pointerId=${this.pointerId}, position=${this.position}, pressure=${this.pressure}, buttons=${this.buttons}}`;
    }
}
