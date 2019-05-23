import { StreamInfo } from '../StreamInfo';

export default abstract class Decoder {
    protected TAG: string = 'Decoder';
    protected streamInfo?: StreamInfo;

    protected constructor(protected tag: HTMLElement) {
    }

    public abstract play(): void;

    public abstract pause(): void;

    public abstract pushFrame(frame: Uint8Array): void;

    public getElement(): HTMLElement {
        return this.tag;
    }

    public getStreamInfo(): StreamInfo | undefined {
        return this.streamInfo;
    }

    public setStreamInfo(streamInfo: StreamInfo): void {
        console.log(`${this.TAG}.setStreamInfo(${streamInfo})`);
        this.pause();
        this.streamInfo = streamInfo;
    }
}
