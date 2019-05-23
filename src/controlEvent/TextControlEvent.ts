import { Buffer } from 'buffer';
import ControlEvent from './ControlEvent';

export default class TextControlEvent extends ControlEvent {
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
        const buffer = new Buffer(length + 1 + 2);
        buffer.writeUInt8(this.type, 0);
        buffer.writeUInt16BE(length, 1);
        buffer.write(this.text, 3);
        return buffer;
    }

    public toString(): string {
        return `TextControlEvent{text=${this.text}}`;
    }
}
