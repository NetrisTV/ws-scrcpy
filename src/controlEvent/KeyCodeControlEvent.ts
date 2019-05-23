import { Buffer } from 'buffer';
import ControlEvent from './ControlEvent';

export default class KeyCodeControlEvent extends ControlEvent {
    constructor(readonly action: number, readonly keycode: number, readonly metaState: number) {
        super(ControlEvent.TYPE_KEYCODE);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer = new Buffer(ControlEvent.KEYCODE_PAYLOAD_LENGTH + 1);
        buffer.writeUInt8(this.type, 0);
        buffer.writeUInt8(this.action, 1);
        buffer.writeUInt32BE(this.keycode, 2);
        buffer.writeUInt32BE(this.metaState, 6);
        return buffer;
    }

    public toString(): string {
        return `KeyCodeControlEvent{action=${this.action}, keycode=${this.keycode}, metaState=${this.metaState}}`;
    }
}
