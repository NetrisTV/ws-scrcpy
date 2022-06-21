import Size from './Size';

export class DisplayInfo {
    public static readonly DEFAULT_DISPLAY = 0x00000000;
    public static readonly FLAG_ROUND = 0b10000;
    public static readonly FLAG_PRESENTATION = 0b1000;
    public static readonly FLAG_PRIVATE = 0b100;
    public static readonly FLAG_SECURE = 0b10;
    public static readonly FLAG_SUPPORTS_PROTECTED_BUFFERS = 0b1;
    public static readonly INVALID_DISPLAY = -1;
    public static readonly BUFFER_LENGTH = 24;

    constructor(
        public readonly displayId: number,
        public readonly size: Size,
        public readonly rotation: number,
        public readonly layerStack: number,
        public readonly flags: number,
    ) {}

    public toBuffer(): Buffer {
        const temp = Buffer.alloc(DisplayInfo.BUFFER_LENGTH);
        let offset = 0;
        offset = temp.writeInt32BE(this.displayId, offset);
        offset = temp.writeInt32BE(this.size.width, offset);
        offset = temp.writeInt32BE(this.size.height, offset);
        offset = temp.writeInt32BE(this.rotation, offset);
        offset = temp.writeInt32BE(this.layerStack, offset);
        temp.writeInt32BE(this.flags, offset);
        return temp;
    }

    public toString(): string {
        // prettier-ignore
        return `DisplayInfo{displayId=${
            this.displayId}, size=${
            this.size}, rotation=${
            this.rotation}, layerStack=${
            this.layerStack}, flags=${
            this.flags}}`;
    }

    public static fromBuffer(buffer: Buffer): DisplayInfo {
        if (buffer.length !== DisplayInfo.BUFFER_LENGTH) {
            throw Error(`Incorrect buffer length. Expected: ${DisplayInfo.BUFFER_LENGTH}, received: ${buffer.length}`);
        }
        let offset = 0;
        const displayId = buffer.readInt32BE(offset);
        offset += 4;
        const width = buffer.readInt32BE(offset);
        offset += 4;
        const height = buffer.readInt32BE(offset);
        offset += 4;
        const rotation = buffer.readInt32BE(offset);
        offset += 4;
        const layerStack = buffer.readInt32BE(offset);
        offset += 4;
        const flags = buffer.readInt32BE(offset);
        return new DisplayInfo(displayId, new Size(width, height), rotation, layerStack, flags);
    }
}
