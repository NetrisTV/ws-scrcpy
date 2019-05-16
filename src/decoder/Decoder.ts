import {StreamInfo} from "../StreamInfo";

export default abstract class Decoder {
    protected streamInfo?: StreamInfo;

    protected constructor(protected tag: HTMLElement) {
    }

    abstract play(): void;

    abstract pause(): void;

    abstract pushFrame(frame: Uint8Array): void;

    public getElement(): HTMLElement {
        return this.tag;
    }

    getStreamInfo() {
        return this.streamInfo;
    }

    setStreamInfo(streamInfo: StreamInfo) {
        this.pause();
        this.streamInfo = streamInfo;
    }
}

