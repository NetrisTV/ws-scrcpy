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

    public static Commands: Map<number, string> = new Map([
        [ControlMessage.TYPE_EXPAND_NOTIFICATION_PANEL, 'Expand notifications'],
        [ControlMessage.TYPE_EXPAND_SETTINGS_PANEL, 'Expand settings'],
        [ControlMessage.TYPE_COLLAPSE_PANELS, 'Collapse panels'],
        [ControlMessage.TYPE_GET_CLIPBOARD, 'Get clipboard'],
        [ControlMessage.TYPE_SET_CLIPBOARD, 'Set clipboard'],
        [ControlMessage.TYPE_ROTATE_DEVICE, 'Rotate device'],
        [ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS, 'Change video settings'],
    ]);

    public static createSetVideoSettingsCommand(videoSettings: VideoSettings): CommandControlMessage {
        const temp = videoSettings.toBuffer();
        const event = new CommandControlMessage(ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS);
        const offset = CommandControlMessage.PAYLOAD_LENGTH + 1;
        const buffer = Buffer.alloc(offset + temp.length);
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
        const buffer = Buffer.alloc(1 + 1 + 4 + textLength);
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

        const buffer = Buffer.alloc(
            offset + typeField + idField + stateField + sizeField + textLengthField + textLength,
        );
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

        const buffer = Buffer.alloc(offset + typeField + idField + stateField + chunkLengthField + chunkLength);
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

    private static createPushFileOtherCommand(id: number, state: FilePushState): CommandControlMessage {
        const event = new CommandControlMessage(ControlMessage.TYPE_PUSH_FILE);
        const typeField = 1;
        const idField = 2;
        const stateField = 1;
        let offset = CommandControlMessage.PAYLOAD_LENGTH;
        const buffer = Buffer.alloc(offset + typeField + idField + stateField);
        buffer.writeUInt8(event.type, offset);
        offset += typeField;
        buffer.writeInt16BE(id, offset);
        offset += idField;
        buffer.writeInt8(state, offset);
        event.buffer = buffer;
        return event;
    }

    public static pushFileCommandFromBuffer(buffer: Buffer): {
        id: number;
        state: FilePushState;
        chunk?: Buffer;
        fileSize?: number;
        fileName?: string;
    } {
        let offset = 0;
        const type = buffer.readUInt8(offset);
        offset += 1;
        if (type !== CommandControlMessage.TYPE_PUSH_FILE) {
            throw TypeError(`Incorrect type: "${type}"`);
        }
        const id = buffer.readInt16BE(offset);
        offset += 2;
        const state = buffer.readInt8(offset);
        offset += 1;
        let chunk: Buffer | undefined;
        let fileSize: number | undefined;
        let fileName: string | undefined;
        if (state === FilePushState.APPEND) {
            const chunkLength = buffer.readUInt32BE(offset);
            offset += 4;
            chunk = buffer.slice(offset, offset + chunkLength);
        } else if (state === FilePushState.START) {
            fileSize = buffer.readUInt32BE(offset);
            offset += 4;
            const textLength = buffer.readUInt16BE(offset);
            offset += 2;
            fileName = Util.utf8ByteArrayToString(buffer.slice(offset, offset + textLength));
        }
        return { id, state, chunk, fileName, fileSize };
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
            const buffer = Buffer.alloc(CommandControlMessage.PAYLOAD_LENGTH + 1);
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
