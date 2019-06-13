import ControlEvent from './ControlEvent';
import StreamInfo from '../StreamInfo';

export default class CommandControlEvent extends ControlEvent {
    public static CommandCodes: Record<string, number> = {
        COMMAND_BACK_OR_SCREEN_ON: 0,
        COMMAND_EXPAND_NOTIFICATION_PANEL: 1,
        COMMAND_COLLAPSE_NOTIFICATION_PANEL: 2,
        COMMAND_CHANGE_STREAM_PARAMETERS: 3
    };

    public static createChangeStreamCommand(streamInfo: StreamInfo): CommandControlEvent {
        const STREAM_INFO_LENGTH = 9;
        const event = new CommandControlEvent(this.CommandCodes.COMMAND_CHANGE_STREAM_PARAMETERS);
        const buffer = new Buffer(ControlEvent.COMMAND_PAYLOAD_LENGTH + 1 + STREAM_INFO_LENGTH);
        buffer.writeUInt8(event.type, 0);
        buffer.writeUInt8(event.action, 1);
        buffer.writeUInt16BE(streamInfo.width, 2);
        buffer.writeUInt16BE(streamInfo.height, 4);
        buffer.writeUInt32BE(streamInfo.bitrate, 6);
        buffer.writeUInt8(streamInfo.frameRate, 10);
        event.buffer = buffer;
        return event;
    }

    private buffer?: Buffer;

    constructor(readonly action: number) {
        super(ControlEvent.TYPE_COMMAND);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        if (!this.buffer) {
            const buffer = new Buffer(ControlEvent.COMMAND_PAYLOAD_LENGTH + 1);
            buffer.writeUInt8(this.type, 0);
            buffer.writeUInt8(this.action, 1);
            this.buffer = buffer;
        }
        return this.buffer;
    }

    public toString(): string {
        const buffer = this.buffer ? `, buffer=[${this.buffer.join(',')}]` : '';
        return `CommandControlEvent{action=${this.action}${buffer}}`;
    }
}
