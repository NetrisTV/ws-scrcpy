export default abstract class Canvas {
    constructor(protected readonly canvas: HTMLCanvasElement) {}
    public abstract decode(buffer: Uint8Array, width: number, height: number): void;
}
