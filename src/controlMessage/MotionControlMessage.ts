import ControlMessage from './ControlMessage';
import Position from '../Position';

export default class MotionControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 17;

    constructor(readonly action: number, readonly buttons: number, readonly position: Position) {
        super(ControlMessage.TYPE_MOUSE);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer: Buffer = new Buffer(MotionControlMessage.PAYLOAD_LENGTH + 1);
        buffer.writeUInt8(this.type, 0);
        buffer.writeUInt8(this.action, 1);
        buffer.writeUInt32BE(this.buttons, 2);
        buffer.writeUInt32BE(this.position.point.x, 6);
        buffer.writeUInt32BE(this.position.point.y, 10);
        buffer.writeUInt16BE(this.position.screenSize.width, 14);
        buffer.writeUInt16BE(this.position.screenSize.height, 16);
        return buffer;
    }

    public toString(): string {
        return `MotionControlMessage{action=${this.action}, buttons=${this.buttons}, position=${this.position}}`;
    }
}
