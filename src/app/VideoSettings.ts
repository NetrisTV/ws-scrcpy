import Rect from './Rect';
import Size from './Size';

interface Settings {
    crop?: Rect | null;
    bitrate: number;
    bounds?: Size | null;
    maxFps: number;
    iFrameInterval: number;
    sendFrameMeta: boolean;
    lockedVideoOrientation: number;
    codecOptions?: string;
}

export default class VideoSettings {
    public static readonly BUFFER_LENGTH: number = 23;
    public readonly crop?: Rect | null = null;
    public readonly bitrate: number = 0;
    public readonly bounds?: Size | null = null;
    public readonly maxFps: number = 0;
    public readonly iFrameInterval: number = 0;
    public readonly sendFrameMeta: boolean = false;
    public readonly lockedVideoOrientation: number = -1;
    public readonly codecOptions: string = '-';

    constructor(data?: Settings) {
        if (data) {
            this.crop = data.crop;
            this.bitrate = data.bitrate;
            this.bounds = data.bounds;
            this.maxFps = data.maxFps;
            this.iFrameInterval = data.iFrameInterval;
            this.sendFrameMeta = data.sendFrameMeta;
            this.lockedVideoOrientation = data.lockedVideoOrientation;
        }
    }

    public static fromBuffer(buffer: Buffer): VideoSettings {
        const bitrate = buffer.readUInt32BE(0);
        const maxFps = buffer.readUInt32BE(4);
        const iFrameInterval = buffer.readUInt8(8);
        const width = buffer.readUInt16BE(9);
        const height = buffer.readUInt16BE(11);
        const left = buffer.readUInt16BE(13);
        const top = buffer.readUInt16BE(15);
        const right = buffer.readUInt16BE(17);
        const bottom = buffer.readUInt16BE(19);
        const sendFrameMeta = !!buffer.readUInt8(21);
        const lockedVideoOrientation = buffer.readInt8(22);
        let bounds: Size | null = null;
        let crop: Rect | null = null;
        if (width !== 0 && height !== 0) {
            bounds = new Size(width, height);
        }
        if (left || top || right || bottom) {
            crop = new Rect(left, top, right, bottom);
        }
        const codecOptions = '-';
        return new VideoSettings({
            crop,
            bitrate,
            bounds,
            maxFps,
            iFrameInterval,
            lockedVideoOrientation,
            sendFrameMeta,
            codecOptions,
        });
    }

    public static copy(a?: VideoSettings | null): VideoSettings | null {
        if (!a) {
            return null;
        }
        return new VideoSettings({
            bitrate: a.bitrate,
            crop: Rect.copy(a.crop),
            bounds: Size.copy(a.bounds),
            maxFps: a.maxFps,
            iFrameInterval: a.iFrameInterval,
            lockedVideoOrientation: a.lockedVideoOrientation,
            sendFrameMeta: a.sendFrameMeta,
            codecOptions: a.codecOptions,
        });
    }

    public equals(o?: VideoSettings | null): boolean {
        if (!o) {
            return false;
        }
        return (
            this.codecOptions === o.codecOptions &&
            Rect.equals(this.crop, o.crop) &&
            this.lockedVideoOrientation === o.lockedVideoOrientation &&
            Size.equals(this.bounds, o.bounds) &&
            this.bitrate === o.bitrate &&
            this.maxFps === o.maxFps &&
            this.iFrameInterval === o.iFrameInterval
        );
    }

    public toBuffer(): Buffer {
        const buffer = new Buffer(VideoSettings.BUFFER_LENGTH);
        const { width = 0, height = 0 } = this.bounds || {};
        const { left = 0, top = 0, right = 0, bottom = 0 } = this.crop || {};
        let offset = 0;
        offset = buffer.writeUInt32BE(this.bitrate, offset);
        offset = buffer.writeUInt32BE(this.maxFps, offset);
        offset = buffer.writeUInt8(this.iFrameInterval, offset);
        offset = buffer.writeUInt16BE(width, offset);
        offset = buffer.writeUInt16BE(height, offset);
        offset = buffer.writeUInt16BE(left, offset);
        offset = buffer.writeUInt16BE(top, offset);
        offset = buffer.writeUInt16BE(right, offset);
        offset = buffer.writeUInt16BE(bottom, offset);
        offset = buffer.writeUInt8(this.sendFrameMeta ? 1 : 0, offset);
        buffer.writeInt8(this.lockedVideoOrientation, offset);
        // FIXME: codec options are ignored
        //  should be something like: "codecOptions=`i-frame-interval=${iFrameInterval}`";
        return buffer;
    }

    public toString(): string {
        // prettier-ignore
        return `VideoSettings{bitrate=${
            this.bitrate}, maxFps=${
            this.maxFps}, iFrameInterval=${
            this.iFrameInterval}, bounds=${
            this.bounds}, crop=${
            this.crop}, metaFrame=${
            this.sendFrameMeta}, lockedVideoOrientation=${
            this.lockedVideoOrientation}}`;
    }

    public toJSON(): Settings {
        return {
            bitrate: this.bitrate,
            maxFps: this.maxFps,
            iFrameInterval: this.iFrameInterval,
            bounds: this.bounds,
            crop: this.crop,
            sendFrameMeta: this.sendFrameMeta,
            lockedVideoOrientation: this.lockedVideoOrientation,
            codecOptions: this.codecOptions,
        };
    }
}
