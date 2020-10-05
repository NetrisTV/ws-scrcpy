import Rect from './Rect';
import Size from './Size';

export default class ScreenInfo {
    public static readonly BUFFER_LENGTH: number = 13;
    constructor(readonly contentRect: Rect, readonly videoSize: Size, readonly deviceRotation: number) {}

    public static fromBuffer(buffer: Buffer): ScreenInfo {
        const left = buffer.readUInt16BE(0);
        const top = buffer.readUInt16BE(2);
        const right = buffer.readUInt16BE(4);
        const bottom = buffer.readUInt16BE(6);
        const width = buffer.readUInt16BE(8);
        const height = buffer.readUInt16BE(10);
        const deviceRotation = buffer.readUInt8(12);
        return new ScreenInfo(new Rect(left, top, right, bottom), new Size(width, height), deviceRotation);
    }

    public equals(o?: ScreenInfo | null): boolean {
        if (!o) {
            return false;
        }
        return (
            this.contentRect.equals(o.contentRect) &&
            this.videoSize.equals(o.videoSize) &&
            this.deviceRotation === o.deviceRotation
        );
    }

    public toString(): string {
        return `ScreenInfo{contentRect=${this.contentRect}, videoSize=${this.videoSize}, deviceRotation=${this.deviceRotation}}`;
    }
}
