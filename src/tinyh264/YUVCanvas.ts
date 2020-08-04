import Canvas from './Canvas';

export default class YUVCanvas extends Canvas {
    private canvasCtx: CanvasRenderingContext2D;
    private canvasBuffer: ImageData | null = null;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.canvasCtx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    }
    public decode(buffer: Uint8Array, width: number, height: number): void {
        if (!buffer) {
            return;
        }
        if (!this.canvasBuffer) {
            this.canvasBuffer = this.canvasCtx.createImageData(width, height);
        }

        const lumaSize = width * height;
        const chromaSize = lumaSize >> 2;

        const ybuf = buffer.subarray(0, lumaSize);
        const ubuf = buffer.subarray(lumaSize, lumaSize + chromaSize);
        const vbuf = buffer.subarray(lumaSize + chromaSize, lumaSize + 2 * chromaSize);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const yIndex = x + y * width;
                const uIndex = ~~(y / 2) * ~~(width / 2) + ~~(x / 2);
                const vIndex = ~~(y / 2) * ~~(width / 2) + ~~(x / 2);
                const R = 1.164 * (ybuf[yIndex] - 16) + 1.596 * (vbuf[vIndex] - 128);
                const G = 1.164 * (ybuf[yIndex] - 16) - 0.813 * (vbuf[vIndex] - 128) - 0.391 * (ubuf[uIndex] - 128);
                const B = 1.164 * (ybuf[yIndex] - 16) + 2.018 * (ubuf[uIndex] - 128);

                const rgbIndex = yIndex * 4;
                this.canvasBuffer.data[rgbIndex + 0] = R;
                this.canvasBuffer.data[rgbIndex + 1] = G;
                this.canvasBuffer.data[rgbIndex + 2] = B;
                this.canvasBuffer.data[rgbIndex + 3] = 0xff;
            }
        }

        this.canvasCtx.putImageData(this.canvasBuffer, 0, 0);
    }
}
