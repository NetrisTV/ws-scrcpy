import Size from './utils/Size';

export default abstract class Canvas {
    protected constructor(readonly canvas: HTMLCanvasElement, readonly size: Size) {}
    public abstract decode(buffer: Uint8Array, width: number, height: number): void;
}
