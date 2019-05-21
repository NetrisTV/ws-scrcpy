interface StreamInfoInterface {
    "width": number
    "height": number
    "frameRate": number
    "bitrate": number
}

export class StreamInfo {
    readonly width: number = 0;
    readonly height: number = 0;
    readonly frameRate: number = 0;
    readonly bitrate: number = 0;

    constructor(data?: StreamInfoInterface) {
        if (data) {
            this.width = data.width;
            this.height = data.height;
            this.frameRate = data.frameRate;
            this.bitrate = data.bitrate;
        }
    }

    static fromBuffer(buffer: Buffer): StreamInfo {
        return  new StreamInfo({
            width: buffer.readUInt16BE(0),
            height: buffer.readUInt16BE(2),
            frameRate: buffer.readUInt8(8),
            bitrate: buffer.readUInt32BE(4)
        });
    }

    public equals(streamInfo: StreamInfo): boolean {
        if (streamInfo === null) {
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

    toString(): string {
        return `StreamInfo{width=${
            this.width}, height=${
            this.height}}, frameRate=${
            this.frameRate}, bitrate=${
            this.bitrate}}`;
    }
}
