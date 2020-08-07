import Rect from './Rect';

interface Settings {
    crop?: Rect | null;
    bitrate: number;
    maxSize: number;
    frameRate: number;
    iFrameInterval: number;
    sendFrameMeta: boolean;
    lockedVideoOrientation: number;
    codecOptions?: string;
}

export default class VideoSettings {
    public static readonly BUFFER_LENGTH: number = 20;
    public readonly crop?: Rect | null = null;
    public readonly bitrate: number = 0;
    public readonly maxSize: number = 0;
    public readonly frameRate: number = 0;
    public readonly iFrameInterval: number = 0;
    public readonly sendFrameMeta: boolean = false;
    public readonly lockedVideoOrientation: number = -1;
    public readonly codecOptions: string = '-';

    constructor(data?: Settings) {
        if (data) {
            this.crop = data.crop;
            this.bitrate = data.bitrate;
            this.maxSize = data.maxSize;
            this.frameRate = data.frameRate;
            this.iFrameInterval = data.iFrameInterval;
            this.sendFrameMeta = data.sendFrameMeta;
            this.lockedVideoOrientation = data.lockedVideoOrientation;
        }
    }

    public static fromBuffer(buffer: Buffer): VideoSettings {
        const bitrate = buffer.readUInt32BE(0);
        const frameRate = buffer.readUInt8(4);
        const iFrameInterval = buffer.readUInt8(5);
        const maxSize = buffer.readUInt32BE(6);
        const left = buffer.readUInt16BE(10);
        const top = buffer.readUInt16BE(12);
        const right = buffer.readUInt16BE(14);
        const bottom = buffer.readUInt16BE(16);
        const sendFrameMeta = !!buffer.readUInt8(18);
        const lockedVideoOrientation = buffer.readInt8(19);
        let crop: Rect | null = null;
        if (left || top || right || bottom) {
            crop = new Rect(left, top, right, bottom);
        }
        const codecOptions = '-';
        return new VideoSettings({
            crop,
            bitrate,
            maxSize,
            frameRate,
            iFrameInterval,
            lockedVideoOrientation,
            sendFrameMeta,
            codecOptions
        });
    }

    public static copy(a?: VideoSettings | null): VideoSettings | null {
        if (!a) {
            return null;
        }
        return new VideoSettings({
            bitrate: a.bitrate,
            crop: Rect.copy(a.crop),
            maxSize: a.maxSize,
            frameRate: a.frameRate,
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
            this.maxSize === o.maxSize &&
            this.bitrate === o.bitrate &&
            this.frameRate === o.frameRate &&
            this.iFrameInterval === o.iFrameInterval
        );
    }

    public toBuffer(): Buffer {
        const buffer = new Buffer(VideoSettings.BUFFER_LENGTH);
        const { left = 0, top = 0, right = 0, bottom = 0 } = this.crop || {};
        let offset = 0;
        offset = buffer.writeUInt32BE(this.bitrate, offset);
        offset = buffer.writeUInt8(this.frameRate, offset);
        offset = buffer.writeUInt8(this.iFrameInterval, offset);
        offset = buffer.writeUInt32BE(this.maxSize, offset);
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
            this.bitrate}, frameRate=${
            this.frameRate}, iFrameInterval=${
            this.iFrameInterval}, maxSize=${
            this.maxSize}, crop=${
            this.crop}, metaFrame=${
            this.sendFrameMeta}, lockedVideoOrientation=${
            this.lockedVideoOrientation}}`;
    }

    public toJSON(): Settings {
        return {
            bitrate: this.bitrate,
            frameRate: this.frameRate,
            iFrameInterval: this.iFrameInterval,
            maxSize: this.maxSize,
            crop: this.crop,
            sendFrameMeta: this.sendFrameMeta,
            lockedVideoOrientation: this.lockedVideoOrientation,
            codecOptions: this.codecOptions,
        };
    }
}
