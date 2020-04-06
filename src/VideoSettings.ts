import Size from './Size';
import Rect from './Rect';

interface Settings {
    crop?: Rect | null;
    bitrate: number;
    bounds?: Size | null;
    frameRate: number;
    iFrameInterval: number;
    sendFrameMeta: boolean;
}

export default class VideoSettings {
    public static readonly BUFFER_LENGTH: number = 19;
    public readonly crop?: Rect | null = null;
    public readonly bitrate: number = 0;
    public readonly bounds?: Size | null = null;
    public readonly frameRate: number = 0;
    public readonly iFrameInterval: number = 0;
    public readonly sendFrameMeta: boolean = false;

    constructor(data?: Settings) {
        if (data) {
            this.crop = data.crop;
            this.bitrate = data.bitrate;
            this.bounds = data.bounds;
            this.frameRate = data.frameRate;
            this.iFrameInterval = data.iFrameInterval;
            this.sendFrameMeta = data.sendFrameMeta;
        }
    }

    public static fromBuffer(buffer: Buffer): VideoSettings {
        const bitrate = buffer.readUInt32BE(0);
        const frameRate = buffer.readUInt8(4);
        const iFrameInterval = buffer.readUInt8(5);
        const width = buffer.readUInt16BE(6);
        const height = buffer.readUInt16BE(8);
        const left = buffer.readUInt16BE(10);
        const top = buffer.readUInt16BE(12);
        const right = buffer.readUInt16BE(14);
        const bottom = buffer.readUInt16BE(16);
        const sendFrameMeta = !!buffer.readUInt8(18);
        let bounds: Size | null = null;
        let crop: Rect | null = null;
        if (width || height) {
            bounds = new Size(width, height);
        }
        if (left || top || right || bottom) {
            crop = new Rect(left, top, right, bottom);
        }
        return new VideoSettings({
            crop,
            bitrate,
            bounds,
            frameRate,
            iFrameInterval,
            sendFrameMeta
        });
    }

    public static copy(a?: VideoSettings|null): VideoSettings|null {
        if (!a) {
            return null;
        }
        return new VideoSettings({
            bitrate: a.bitrate,
            crop: Rect.copy(a.crop),
            bounds: Size.copy(a.bounds),
            frameRate: a.frameRate,
            iFrameInterval: a.iFrameInterval,
            sendFrameMeta: a.sendFrameMeta
        });
    }

    public equals(o?: VideoSettings | null): boolean {
        if (!o) {
            return false;
        }
        return Rect.equals(this.crop, o.crop) &&
            Size.equals(this.bounds, o.bounds) &&
            this.bitrate === o.bitrate &&
            this.frameRate === o.frameRate &&
            this.iFrameInterval === o.iFrameInterval;
    }

    public toBuffer(): Buffer {
        const buffer = new Buffer(21);
        const {width = 0, height = 0} = this.bounds || {};
        const {left = 0, top = 0, right = 0, bottom = 0} = this.crop || {};
        buffer.writeUInt32BE(this.bitrate, 0);
        buffer.writeUInt8(this.frameRate, 4);
        buffer.writeUInt8(this.iFrameInterval, 5);
        buffer.writeUInt16BE(width, 6);
        buffer.writeUInt16BE(height, 8);
        buffer.writeUInt16BE(left, 10);
        buffer.writeUInt16BE(top, 12);
        buffer.writeUInt16BE(right, 14);
        buffer.writeUInt16BE(bottom, 16);
        buffer.writeUInt8(this.sendFrameMeta ? 1 : 0, 16);
        return buffer;
    }

    public toString(): string {
        return `VideoSettings{bitrate=${
            this.bitrate}, frameRate=${
            this.frameRate}, iFrameInterval=${
            this.iFrameInterval}, bounds=${
            this.bounds}, crop=${
            this.crop}}`;
    }
}
