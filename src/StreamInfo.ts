interface StreamInfoInterface {
    "width": number
    "height": number
    "frameRate": number
    "bitRate": number
    "type": string
}

export class StreamInfo {
    readonly width: number = 0;
    readonly height: number = 0;
    readonly frameRate: number = 0;
    readonly bitRate: number = 0;

    constructor(data?: StreamInfoInterface) {
        if (data) {
            this.width = data.width;
            this.height = data.height;
            this.frameRate = data.frameRate;
            this.bitRate = data.bitRate;
        }
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
