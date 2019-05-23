import ControlEvent from './ControlEvent';

export default class CommandControlEvent extends ControlEvent {
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
            const l = this.buffer.length;
            for (let i = 0; i < l; i++) {
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
