import Rect from './Rect';
import Size from './Size';
import Util from './Util';

interface Settings {
    crop?: Rect | null;
    bitrate: number;
    bounds?: Size | null;
    maxFps: number;
    iFrameInterval: number;
    sendFrameMeta?: boolean;
    lockedVideoOrientation?: number;
    displayId?: number;
    codecOptions?: string;
    encoderName?: string;
}

export default class VideoSettings {
    public static readonly BASE_BUFFER_LENGTH: number = 35;
    public readonly crop?: Rect | null = null;
    public readonly bitrate: number = 0;
    public readonly bounds?: Size | null = null;
    public readonly maxFps: number = 0;
    public readonly iFrameInterval: number = 0;
    public readonly sendFrameMeta: boolean = false;
    public readonly lockedVideoOrientation: number = -1;
    public readonly displayId: number = 0;
    public readonly codecOptions?: string;
    public readonly encoderName?: string;

    constructor(data?: Settings, public readonly bytesLength: number = VideoSettings.BASE_BUFFER_LENGTH) {
        if (data) {
            this.crop = data.crop;
            this.bitrate = data.bitrate;
            this.bounds = data.bounds;
            this.maxFps = data.maxFps;
            this.iFrameInterval = data.iFrameInterval;
            this.sendFrameMeta = data.sendFrameMeta || false;
            this.lockedVideoOrientation = data.lockedVideoOrientation || -1;
            if (typeof data.displayId === 'number' && !isNaN(data.displayId) && data.displayId >= 0) {
                this.displayId = data.displayId;
            }
            if (data.codecOptions) {
                this.codecOptions = data.codecOptions.trim();
            }
            if (data.encoderName) {
                this.encoderName = data.encoderName.trim();
            }
        }
    }

    public static fromBuffer(buffer: Buffer): VideoSettings {
        let offset = 0;
        const bitrate = buffer.readInt32BE(offset);
        offset += 4;
        const maxFps = buffer.readInt32BE(offset);
        offset += 4;
        const iFrameInterval = buffer.readInt8(offset);
        offset += 1;
        const width = buffer.readInt16BE(offset);
        offset += 2;
        const height = buffer.readInt16BE(offset);
        offset += 2;
        const left = buffer.readInt16BE(offset);
        offset += 2;
        const top = buffer.readInt16BE(offset);
        offset += 2;
        const right = buffer.readInt16BE(offset);
        offset += 2;
        const bottom = buffer.readInt16BE(offset);
        offset += 2;
        const sendFrameMeta = !!buffer.readInt8(offset);
        offset += 1;
        const lockedVideoOrientation = buffer.readInt8(offset);
        offset += 1;
        const displayId = buffer.readInt32BE(offset);
        offset += 4;
        let bounds: Size | null = null;
        let crop: Rect | null = null;
        if (width !== 0 && height !== 0) {
            bounds = new Size(width, height);
        }
        if (left || top || right || bottom) {
            crop = new Rect(left, top, right, bottom);
        }
        let codecOptions;
        let encoderName;
        const codecOptionsLength = buffer.readInt32BE(offset);
        offset += 4;
        if (codecOptionsLength) {
            const codecOptionsBytes = buffer.slice(offset, offset + codecOptionsLength);
            offset += codecOptionsLength;
            codecOptions = Util.utf8ByteArrayToString(codecOptionsBytes);
        }
        const encoderNameLength = buffer.readInt32BE(offset);
        offset += 4;
        if (encoderNameLength) {
            const encoderNameBytes = buffer.slice(offset, offset + encoderNameLength);
            offset += encoderNameLength;
            encoderName = Util.utf8ByteArrayToString(encoderNameBytes);
        }
        return new VideoSettings(
            {
                crop,
                bitrate,
                bounds,
                maxFps,
                iFrameInterval,
                lockedVideoOrientation,
                displayId,
                sendFrameMeta,
                codecOptions,
                encoderName,
            },
            offset,
        );
    }

    public static copy(a: VideoSettings): VideoSettings {
        return new VideoSettings(
            {
                bitrate: a.bitrate,
                crop: Rect.copy(a.crop),
                bounds: Size.copy(a.bounds),
                maxFps: a.maxFps,
                iFrameInterval: a.iFrameInterval,
                lockedVideoOrientation: a.lockedVideoOrientation,
                displayId: a.displayId,
                sendFrameMeta: a.sendFrameMeta,
                codecOptions: a.codecOptions,
                encoderName: a.encoderName,
            },
            a.bytesLength,
        );
    }

    public equals(o?: VideoSettings | null): boolean {
        if (!o) {
            return false;
        }
        return (
            this.encoderName === o.encoderName &&
            this.codecOptions === o.codecOptions &&
            Rect.equals(this.crop, o.crop) &&
            this.lockedVideoOrientation === o.lockedVideoOrientation &&
            this.displayId === o.displayId &&
            Size.equals(this.bounds, o.bounds) &&
            this.bitrate === o.bitrate &&
            this.maxFps === o.maxFps &&
            this.iFrameInterval === o.iFrameInterval
        );
    }

    public toBuffer(): Buffer {
        let additionalLength = 0;
        let codecOptionsBytes;
        let encoderNameBytes;
        if (this.codecOptions) {
            codecOptionsBytes = Util.stringToUtf8ByteArray(this.codecOptions);
            additionalLength += codecOptionsBytes.length;
        }
        if (this.encoderName) {
            encoderNameBytes = Util.stringToUtf8ByteArray(this.encoderName);
            additionalLength += encoderNameBytes.length;
        }
        const buffer = Buffer.alloc(VideoSettings.BASE_BUFFER_LENGTH + additionalLength);
        const { width = 0, height = 0 } = this.bounds || {};
        const { left = 0, top = 0, right = 0, bottom = 0 } = this.crop || {};
        let offset = 0;
        offset = buffer.writeInt32BE(this.bitrate, offset);
        offset = buffer.writeInt32BE(this.maxFps, offset);
        offset = buffer.writeInt8(this.iFrameInterval, offset);
        offset = buffer.writeInt16BE(width, offset);
        offset = buffer.writeInt16BE(height, offset);
        offset = buffer.writeInt16BE(left, offset);
        offset = buffer.writeInt16BE(top, offset);
        offset = buffer.writeInt16BE(right, offset);
        offset = buffer.writeInt16BE(bottom, offset);
        offset = buffer.writeInt8(this.sendFrameMeta ? 1 : 0, offset);
        offset = buffer.writeInt8(this.lockedVideoOrientation, offset);
        offset = buffer.writeInt32BE(this.displayId, offset);
        if (codecOptionsBytes) {
            offset = buffer.writeInt32BE(codecOptionsBytes.length, offset);
            buffer.fill(codecOptionsBytes, offset);
            offset += codecOptionsBytes.length;
        } else {
            offset = buffer.writeInt32BE(0, offset);
        }
        if (encoderNameBytes) {
            offset = buffer.writeInt32BE(encoderNameBytes.length, offset);
            buffer.fill(encoderNameBytes, offset);
            offset += encoderNameBytes.length;
        } else {
            buffer.writeInt32BE(0, offset);
        }
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
            this.lockedVideoOrientation}, displayId=${
            this.displayId}, codecOptions=${
            this.codecOptions}, encoderName=${
            this.encoderName}}`;
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
            displayId: this.displayId,
            codecOptions: this.codecOptions,
            encoderName: this.encoderName,
        };
    }
}
