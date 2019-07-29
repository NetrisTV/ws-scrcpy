import ControlEvent from './ControlEvent';
import VideoSettings from '../VideoSettings';
import Util from '../Util';

export default class CommandControlEvent extends ControlEvent {
    public static CommandCodes: Record<string, number> = {
        TYPE_EXPAND_NOTIFICATION_PANEL: ControlEvent.TYPE_EXPAND_NOTIFICATION_PANEL,
        TYPE_COLLAPSE_NOTIFICATION_PANEL: ControlEvent.TYPE_COLLAPSE_NOTIFICATION_PANEL,
        TYPE_GET_CLIPBOARD: ControlEvent.TYPE_GET_CLIPBOARD,
        TYPE_SET_CLIPBOARD: ControlEvent.TYPE_SET_CLIPBOARD,
        TYPE_CHANGE_STREAM_PARAMETERS: ControlEvent.TYPE_CHANGE_STREAM_PARAMETERS
    };

    public static CommandNames: Record<number, string> = {
        5: 'Expand panel',
        6: 'Collapse panel',
        7: 'Get clipboard',
        8: 'Set clipboard',
        10: 'Change video settings'
    };

    public static createSetVideoSettingsCommand(videoSettings: VideoSettings): CommandControlEvent {
        const temp = videoSettings.toBuffer();
        const event = new CommandControlEvent(ControlEvent.TYPE_CHANGE_STREAM_PARAMETERS);
        const offset = ControlEvent.COMMAND_PAYLOAD_LENGTH + 1;
        const buffer = new Buffer(offset + temp.length);
        buffer.writeUInt8(event.type, 0);
        temp.forEach((byte, index) => {
            buffer.writeUInt8(byte, index + offset);
        });
        event.buffer = buffer;
        return event;
    }

    public static createSetClipboard(text: string): CommandControlEvent {
        const event = new CommandControlEvent(ControlEvent.TYPE_SET_CLIPBOARD);
        const temp = Util.stringToUtf8ByteArray(text);
        let offset = ControlEvent.COMMAND_PAYLOAD_LENGTH + 1;
        const buffer = new Buffer(offset + 2 + temp.length);
        buffer.writeUInt8(event.type, 0);
        buffer.writeUInt16BE(temp.length, offset);
        offset += 2;
        temp.forEach((byte, index) => {
            buffer.writeUInt8(byte, index + offset);
        });
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
            const buffer = new Buffer(ControlEvent.COMMAND_PAYLOAD_LENGTH + 1);
            buffer.writeUInt8(this.type, 0);
            this.buffer = buffer;
        }
        return this.buffer;
    }

    public toString(): string {
        const buffer = this.buffer ? `, buffer=[${this.buffer.join(',')}]` : '';
        return `CommandControlEvent{action=${this.type}${buffer}}`;
    }
}
