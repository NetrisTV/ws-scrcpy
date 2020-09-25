import { ControlMessage, ControlMessageInterface } from './ControlMessage';
import Position, { PositionInterface } from '../Position';

export interface ScrollControlMessageInterface extends ControlMessageInterface {
    position: PositionInterface;
    hScroll: number;
    vScroll: number;
}

export class ScrollControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 20;

    constructor(readonly position: Position, readonly hScroll: number, readonly vScroll: number) {
        super(ControlMessage.TYPE_SCROLL);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer = new Buffer(ScrollControlMessage.PAYLOAD_LENGTH + 1);
        buffer.writeUInt8(this.type, 0);
        buffer.writeUInt32BE(this.position.point.x, 1);
        buffer.writeUInt32BE(this.position.point.y, 5);
        buffer.writeUInt16BE(this.position.screenSize.width, 9);
        buffer.writeUInt16BE(this.position.screenSize.height, 11);
        buffer.writeUInt32BE(this.hScroll, 13);
        buffer.writeUInt32BE(this.vScroll, 17);
        return buffer;
    }

    public toString(): string {
        return `ScrollControlMessage{hScroll=${this.hScroll}, vScroll=${this.vScroll}, position=${this.position}}`;
    }

    public toJSON(): ScrollControlMessageInterface {
        return {
            type: this.type,
            position: this.position.toJSON(),
            hScroll: this.hScroll,
            vScroll: this.vScroll,
        };
    }
}
