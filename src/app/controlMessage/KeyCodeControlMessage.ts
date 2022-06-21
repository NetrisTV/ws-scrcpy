import { Buffer } from 'buffer';
import { ControlMessage, ControlMessageInterface } from './ControlMessage';

export interface KeyCodeControlMessageInterface extends ControlMessageInterface {
    action: number;
    keycode: number;
    repeat: number;
    metaState: number;
}

export class KeyCodeControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 13;

    constructor(
        readonly action: number,
        readonly keycode: number,
        readonly repeat: number,
        readonly metaState: number,
    ) {
        super(ControlMessage.TYPE_KEYCODE);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer = Buffer.alloc(KeyCodeControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;
        offset = buffer.writeInt8(this.type, offset);
        offset = buffer.writeInt8(this.action, offset);
        offset = buffer.writeInt32BE(this.keycode, offset);
        offset = buffer.writeInt32BE(this.repeat, offset);
        buffer.writeInt32BE(this.metaState, offset);
        return buffer;
    }

    public toString(): string {
        return `KeyCodeControlMessage{action=${this.action}, keycode=${this.keycode}, metaState=${this.metaState}}`;
    }

    public toJSON(): KeyCodeControlMessageInterface {
        return {
            type: this.type,
            action: this.action,
            keycode: this.keycode,
            metaState: this.metaState,
            repeat: this.repeat,
        };
    }
}
