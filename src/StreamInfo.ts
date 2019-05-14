interface StreamInfoInterface {
    "width": number
    "height": number
    "frameRate": number
    "bitRate": number
    "type": string
}

export class StreamInfo {
    readonly width: number;
    readonly height: number;
    readonly frameRate: number;
    readonly bitRate: number;
    constructor(data: StreamInfoInterface) {
        if (typeof data.width !== 'number') {
            throw TypeError('Wrong width type');
        }
        if (typeof data.height !== 'number') {
            throw TypeError('Wrong height type');
        }
        if (typeof data.frameRate !== 'number') {
            throw TypeError('Wrong frameRate type');
        }
        if (typeof data.bitRate !== 'number') {
            throw TypeError('Wrong bitRate type');
        }
        this.width = data.width;
        this.height = data.height;
        this.frameRate = data.frameRate;
        this.bitRate = data.bitRate;
    }

    public equals(streamInfo: StreamInfo): boolean {
        if (streamInfo === null) {
            return false;
        }
        return this.width === streamInfo.width &&
            this.height === streamInfo.height &&
            this.frameRate === streamInfo.frameRate &&
            this.bitRate === streamInfo.bitRate;
    }
}
