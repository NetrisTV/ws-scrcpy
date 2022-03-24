import { ControlMessage, ControlMessageInterface } from './ControlMessage';
import Position, { PositionInterface } from '../Position';

export interface TouchControlMessageInterface extends ControlMessageInterface {
    type: number;
    action: number;
    pointerId: number;
    position: PositionInterface;
    pressure: number;
    buttons: number;
}

export class TouchControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 28;
    /**
     * - For a touch screen or touch pad, reports the approximate pressure
     * applied to the surface by a finger or other tool.  The value is
     * normalized to a range from 0 (no pressure at all) to 1 (normal pressure),
     * although values higher than 1 may be generated depending on the
     * calibration of the input device.
     * - For a trackball, the value is set to 1 if the trackball button is pressed
     * or 0 otherwise.
     * - For a mouse, the value is set to 1 if the primary mouse button is pressed
     * or 0 otherwise.
     *
     * - scrcpy server expects signed short (2 bytes) for a pressure value
     * - in browser TouchEvent has `force` property (values in 0..1 range), we
     * use it as "pressure" for scrcpy
     */
    public static readonly MAX_PRESSURE_VALUE = 0xffff;

    constructor(
        readonly action: number,
        readonly pointerId: number,
        readonly position: Position,
        readonly pressure: number,
        readonly buttons: number,
    ) {
        super(ControlMessage.TYPE_TOUCH);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer: Buffer = Buffer.alloc(TouchControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;
        offset = buffer.writeUInt8(this.type, offset);
        offset = buffer.writeUInt8(this.action, offset);
        offset = buffer.writeUInt32BE(0, offset); // pointerId is `long` (8 bytes) on java side
        offset = buffer.writeUInt32BE(this.pointerId, offset);
        offset = buffer.writeUInt32BE(this.position.point.x, offset);
        offset = buffer.writeUInt32BE(this.position.point.y, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.width, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.height, offset);
        offset = buffer.writeUInt16BE(this.pressure * TouchControlMessage.MAX_PRESSURE_VALUE, offset);
        buffer.writeUInt32BE(this.buttons, offset);
        return buffer;
    }

    public toString(): string {
        return `TouchControlMessage{action=${this.action}, pointerId=${this.pointerId}, position=${this.position}, pressure=${this.pressure}, buttons=${this.buttons}}`;
    }

    public toJSON(): TouchControlMessageInterface {
        return {
            type: this.type,
            action: this.action,
            pointerId: this.pointerId,
            position: this.position.toJSON(),
            pressure: this.pressure,
            buttons: this.buttons,
        };
    }
}
