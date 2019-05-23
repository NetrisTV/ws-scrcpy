interface IStreamInfoInterface {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
}

export class StreamInfo {
    public readonly width: number = 0;
    public readonly height: number = 0;
    public readonly frameRate: number = 0;
    public readonly bitrate: number = 0;

    constructor(data?: IStreamInfoInterface) {
        if (data) {
            this.width = data.width;
            this.height = data.height;
            this.frameRate = data.frameRate;
            this.bitrate = data.bitrate;
        }
    }

    public static fromBuffer(buffer: Buffer): StreamInfo {
        return  new StreamInfo({
            width: buffer.readUInt16BE(0),
            height: buffer.readUInt16BE(2),
            frameRate: buffer.readUInt8(8),
            bitrate: buffer.readUInt32BE(4)
        });
    }

    public equals(streamInfo?: StreamInfo | null): boolean {
        if (!streamInfo) {
            return false;
        }
        return this.width === streamInfo.width &&
            this.height === streamInfo.height &&
            this.frameRate === streamInfo.frameRate &&
            this.bitrate === streamInfo.bitrate;
    }

    public toBuffer(): Buffer {
        const buffer = new Buffer(9);
        buffer.writeUInt16BE(this.width, 0);
        buffer.writeUInt16BE(this.height, 2);
        buffer.writeUInt32BE(this.bitrate, 4);
        buffer.writeUInt8(this.frameRate, 8);
        return buffer;
    }

    public toString(): string {
        return `StreamInfo{width=${
            this.width}, height=${
            this.height}}, frameRate=${
            this.frameRate}, bitrate=${
            this.bitrate}}`;
    }
}
