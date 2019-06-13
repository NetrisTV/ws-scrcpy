import StreamInfo from '../StreamInfo';

export default abstract class Decoder {
    public static STATE: Record<string, number> = {
        PLAYING: 1,
        PAUSED: 2,
        STOPPED: 3
    };
    protected TAG: string = 'Decoder';
    protected streamInfo?: StreamInfo;
    private state: number = Decoder.STATE.STOPPED;

    protected constructor(protected tag: HTMLElement) {
    }

    public play(): void {
        if (!this.streamInfo) {
            return;
        }
        this.state = Decoder.STATE.PLAYING;
    }

    public pause(): void {
        this.state = Decoder.STATE.PAUSED;
    }

    public stop(): void {
        this.state = Decoder.STATE.STOPPED;
    }

    public getState(): number {
        return this.state;
    }

    public abstract pushFrame(frame: Uint8Array): void;

    public abstract getPreferredStreamSetting(): StreamInfo;

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
