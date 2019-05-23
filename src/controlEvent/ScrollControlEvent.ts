import ControlEvent from './ControlEvent';
import Position from '../Position';

export default class ScrollControlEvent extends ControlEvent {
    constructor(readonly position: Position, readonly hScroll: number, readonly vScroll: number) {
        super(ControlEvent.TYPE_SCROLL);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer = new Buffer(ControlEvent.SCROLL_PAYLOAD_LENGTH + 1);
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
        return `ScrollControlEvent{hScroll=${this.hScroll}, vScroll=${this.vScroll}, position=${this.position}}`;
    }
}
