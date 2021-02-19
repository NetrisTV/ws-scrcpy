import Rect from './Rect';
import Size from './Size';

export default class ScreenInfo {
    public static readonly BUFFER_LENGTH: number = 25;
    constructor(readonly contentRect: Rect, readonly videoSize: Size, readonly deviceRotation: number) {}

    public static fromBuffer(buffer: Buffer): ScreenInfo {
        const left = buffer.readInt32BE(0);
        const top = buffer.readInt32BE(4);
        const right = buffer.readInt32BE(8);
        const bottom = buffer.readInt32BE(12);
        const width = buffer.readInt32BE(16);
        const height = buffer.readInt32BE(20);
        const deviceRotation = buffer.readUInt8(24);
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
