import { ControlMessage } from './ControlMessage';
import VideoSettings from '../VideoSettings';
import Util from '../Util';

export enum FilePushState {
    NEW,
    START,
    APPEND,
    FINISH,
    CANCEL,
}

type FilePushParams = {
    id: number;
    state: FilePushState;
    chunk?: Uint8Array;
    fileName?: string;
    fileSize?: number;
};

export class CommandControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 0;

    public static CommandCodes: Record<string, number> = {
        TYPE_EXPAND_NOTIFICATION_PANEL: ControlMessage.TYPE_EXPAND_NOTIFICATION_PANEL,
        TYPE_COLLAPSE_NOTIFICATION_PANEL: ControlMessage.TYPE_COLLAPSE_NOTIFICATION_PANEL,
        TYPE_GET_CLIPBOARD: ControlMessage.TYPE_GET_CLIPBOARD,
        TYPE_SET_CLIPBOARD: ControlMessage.TYPE_SET_CLIPBOARD,
        TYPE_ROTATE_DEVICE: ControlMessage.TYPE_ROTATE_DEVICE,
        TYPE_CHANGE_STREAM_PARAMETERS: ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS,
    };

    public static CommandNames: Record<number, string> = {
        5: 'Expand panel',
        6: 'Collapse panel',
        7: 'Get clipboard',
        8: 'Set clipboard',
        10: 'Rotate device',
        101: 'Change video settings',
    };

    public static createSetVideoSettingsCommand(videoSettings: VideoSettings): CommandControlMessage {
        const temp = videoSettings.toBuffer();
        const event = new CommandControlMessage(ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS);
        const offset = CommandControlMessage.PAYLOAD_LENGTH + 1;
        const buffer = new Buffer(offset + temp.length);
        buffer.writeUInt8(event.type, 0);
        temp.forEach((byte, index) => {
            buffer.writeUInt8(byte, index + offset);
        });
        event.buffer = buffer;
        return event;
    }

    public static createSetClipboardCommand(text: string, paste = false): CommandControlMessage {
        const event = new CommandControlMessage(ControlMessage.TYPE_SET_CLIPBOARD);
        const textBytes: Uint8Array | null = text ? Util.stringToUtf8ByteArray(text) : null;
        const textLength = textBytes ? textBytes.length : 0;
        let offset = 0;
        const buffer = new Buffer(1 + 1 + 4 + textLength);
        offset = buffer.writeInt8(event.type, offset);
        offset = buffer.writeInt8(paste ? 1 : 0, offset);
        offset = buffer.writeInt32BE(textLength, offset);
        if (textBytes) {
            textBytes.forEach((byte: number, index: number) => {
                buffer.writeUInt8(byte, index + offset);
            });
        }
        event.buffer = buffer;
        return event;
    }

    public static createSetScreenPowerModeCommand(mode: boolean): CommandControlMessage {
        const event = new CommandControlMessage(ControlMessage.TYPE_SET_SCREEN_POWER_MODE);
        let offset = 0;
        const buffer = Buffer.alloc(1 + 1);
        offset = buffer.writeInt8(event.type, offset);
        buffer.writeUInt8(mode ? 1 : 0, offset);
        event.buffer = buffer;
        return event;
    }

    public static createPushFileCommand(params: FilePushParams): CommandControlMessage {
        const { id, fileName, fileSize, chunk, state } = params;

        if (state === FilePushState.START) {
            return this.createPushFileStartCommand(id, fileName as string, fileSize as number);
        }
        if (state === FilePushState.APPEND) {
            if (!chunk) {
                throw TypeError('Invalid type');
            }
            return this.createPushFileChunkCommand(id, chunk);
        }
        if (state === FilePushState.CANCEL || state === FilePushState.FINISH || state === FilePushState.NEW) {
            return this.createPushFileOtherCommand(id, state);
        }

        throw TypeError(`Unsupported state: "${state}"`);
    }

    private static createPushFileStartCommand(id: number, fileName: string, fileSize: number): CommandControlMessage {
        const event = new CommandControlMessage(ControlMessage.TYPE_PUSH_FILE);
        const text = Util.stringToUtf8ByteArray(fileName);
        const typeField = 1;
        const idField = 2;
        const stateField = 1;
        const sizeField = 4;
        const textLengthField = 2;
        const textLength = text.length;
        let offset = CommandControlMessage.PAYLOAD_LENGTH;

        const buffer = new Buffer(offset + typeField + idField + stateField + sizeField + textLengthField + textLength);
        buffer.writeUInt8(event.type, offset);
        offset += typeField;
        buffer.writeInt16BE(id, offset);
        offset += idField;
        buffer.writeInt8(FilePushState.START, offset);
        offset += stateField;
        buffer.writeUInt32BE(fileSize, offset);
        offset += sizeField;
        buffer.writeUInt16BE(textLength, offset);
        offset += textLengthField;
        text.forEach((byte, index) => {
            buffer.writeUInt8(byte, index + offset);
        });
        event.buffer = buffer;
        return event;
    }

    private static createPushFileChunkCommand(id: number, chunk: Uint8Array): CommandControlMessage {
        const event = new CommandControlMessage(ControlMessage.TYPE_PUSH_FILE);
        const typeField = 1;
        const idField = 2;
        const stateField = 1;
        const chunkLengthField = 4;
        const chunkLength = chunk.byteLength;
        let offset = CommandControlMessage.PAYLOAD_LENGTH;

        const buffer = new Buffer(offset + typeField + idField + stateField + chunkLengthField + chunkLength);
        buffer.writeUInt8(event.type, offset);
        offset += typeField;
        buffer.writeInt16BE(id, offset);
        offset += idField;
        buffer.writeInt8(FilePushState.APPEND, offset);
        offset += stateField;
        buffer.writeUInt32BE(chunkLength, offset);
        offset += chunkLengthField;
        Array.from(chunk).forEach((byte, index) => {
            buffer.writeUInt8(byte, index + offset);
        });
        event.buffer = buffer;
        return event;
    }

    private static createPushFileOtherCommand(id: number, state: FilePushState) {
        const event = new CommandControlMessage(ControlMessage.TYPE_PUSH_FILE);
        const typeField = 1;
        const idField = 2;
        const stateField = 1;
        let offset = CommandControlMessage.PAYLOAD_LENGTH;
        const buffer = new Buffer(offset + typeField + idField + stateField);
        buffer.writeUInt8(event.type, offset);
        offset += typeField;
        buffer.writeInt16BE(id, offset);
        offset += idField;
        buffer.writeInt8(state, offset);
        event.buffer = buffer;
        return event;
    }

    private buffer?: Buffer;

    constructor(readonly type: number) {
        super(type);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        if (!this.buffer) {
            const buffer = new Buffer(CommandControlMessage.PAYLOAD_LENGTH + 1);
            buffer.writeUInt8(this.type, 0);
            this.buffer = buffer;
        }
        return this.buffer;
    }

    public toString(): string {
        const buffer = this.buffer ? `, buffer=[${this.buffer.join(',')}]` : '';
        return `CommandControlMessage{action=${this.type}${buffer}}`;
    }
}
