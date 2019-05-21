import Position from "./Position";
import {Buffer} from "buffer";

export class ControlEvent {
    public static TYPE_KEYCODE = 0;
    public static TYPE_TEXT = 1;
    public static TYPE_MOUSE = 2;
    public static TYPE_SCROLL = 3;
    public static TYPE_COMMAND = 4;

    public static KEYCODE_PAYLOAD_LENGTH = 9;
    public static MOUSE_PAYLOAD_LENGTH = 17;
    public static SCROLL_PAYLOAD_LENGTH = 20;
    public static COMMAND_PAYLOAD_LENGTH = 1;

    constructor(readonly type: number) {
    }

    static createKeycodeControlEvent(action: number, keycode: number, metaState: number) {
        return new KeyCodeControlEvent(action, keycode, metaState);
    }

    static createTextControlEvent(text: string) {
        return new TextControlEvent(text);
    }

    static createMotionControlEvent(action: number, buttons: number, position: Position) {
        return new MotionControlEvent(action, buttons, position);
    }

    static createScrollControlEvent(position: Position, hScroll: number, vScroll: number) {
        return new ScrollControlEvent(position, hScroll, vScroll);
    }

    static createCommandControlEvent(action: number) {
        return new CommandControlEvent(action);
    }

    public toBuffer(): Buffer {
        throw Error('Not implemented');
    }
}

export class CommandControlEvent extends ControlEvent {
    public static CommandCodes: Record<string, number> = {
        COMMAND_BACK_OR_SCREEN_ON: 0,
        COMMAND_EXPAND_NOTIFICATION_PANEL: 1,
        COMMAND_COLLAPSE_NOTIFICATION_PANEL: 2,
        COMMAND_CHANGE_STREAM_PARAMETERS: 3
    };

    constructor(readonly action: number, readonly buffer?: Buffer) {
        super(ControlEvent.TYPE_COMMAND);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        let buffer: Buffer;
        if (!this.buffer) {
            buffer = new Buffer(ControlEvent.COMMAND_PAYLOAD_LENGTH + 1);
        } else {
            buffer = new Buffer(ControlEvent.COMMAND_PAYLOAD_LENGTH + 1 + this.buffer.length);
            for (let i = 0, l = this.buffer.length; i < l; i++) {
                buffer.writeUInt8(this.buffer.readUInt8(i), i + 2);
            }
        }
        buffer.writeUInt8(this.type, 0);
        buffer.writeUInt8(this.action, 1);
        return buffer;
    }

    public toString(): string {
        return `KeyCodeControlEvent{action=${this.action}}`;
    }
}

export class KeyCodeControlEvent extends ControlEvent {
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

export class MotionControlEvent extends ControlEvent {
    constructor(readonly action: number, readonly buttons: number, readonly position: Position) {
        super(ControlEvent.TYPE_MOUSE);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer: Buffer = new Buffer(ControlEvent.MOUSE_PAYLOAD_LENGTH + 1);
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
        return `MotionControlEvent{action=${this.action}, buttons=${this.buttons}, position=${this.position}}`;
    }
}

export class ScrollControlEvent extends ControlEvent {
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

export class TextControlEvent extends ControlEvent {
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
