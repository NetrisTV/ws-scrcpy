import ControlEvent from './ControlEvent';
import VideoSettings from '../VideoSettings';

export default class CommandControlEvent extends ControlEvent {
    public static CommandCodes: Record<string, number> = {
        COMMAND_BACK_OR_SCREEN_ON: 0,
        COMMAND_EXPAND_NOTIFICATION_PANEL: 1,
        COMMAND_COLLAPSE_NOTIFICATION_PANEL: 2,
        COMMAND_SET_VIDEO_SETTINGS: 3
    };

    public static createSetVideoSettingsCommand(videoSettings: VideoSettings): CommandControlEvent {
        const temp = videoSettings.toBuffer();
        const event = new CommandControlEvent(this.CommandCodes.COMMAND_SET_VIDEO_SETTINGS);
        const buffer = new Buffer(ControlEvent.COMMAND_PAYLOAD_LENGTH + 1 + temp.length);
        buffer.writeUInt8(event.type, 0);
        buffer.writeUInt8(event.action, 1);
        temp.forEach((byte, index) => {
            buffer.writeUInt8(byte, index + 2);
        });
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
