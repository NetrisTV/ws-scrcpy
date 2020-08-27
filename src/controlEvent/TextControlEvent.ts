import { Buffer } from 'buffer';
import ControlEvent from './ControlEvent';

export default class TextControlEvent extends ControlEvent {
    private static TEXT_SIZE_FIELD_LENGTH = 4;
    constructor(readonly text: string) {
        super(ControlEvent.TYPE_TEXT);
    }

    public getText(): string {
        return this.text;
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const length = this.text.length;
        const buffer = new Buffer(length + 1 + TextControlEvent.TEXT_SIZE_FIELD_LENGTH);
        let offset = 0;
        offset = buffer.writeUInt8(this.type, offset);
        offset = buffer.writeUInt32BE(length, offset);
        buffer.write(this.text, offset);
        return buffer;
    }

    public toString(): string {
        return `TextControlEvent{text=${this.text}}`;
    }
}
