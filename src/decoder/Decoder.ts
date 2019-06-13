import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';

export default abstract class Decoder {
    public static STATE: Record<string, number> = {
        PLAYING: 1,
        PAUSED: 2,
        STOPPED: 3
    };
    protected TAG: string = 'Decoder';
    protected screenInfo?: ScreenInfo;
    protected videoSettings?: VideoSettings;
    private state: number = Decoder.STATE.STOPPED;

    protected constructor(protected tag: HTMLElement) {
    }

    public play(): void {
        if (!this.screenInfo) {
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

    public abstract getPreferredVideoSetting(): VideoSettings;

    public getElement(): HTMLElement {
        return this.tag;
    }

    public getVideoSettings(): VideoSettings|undefined {
        return this.videoSettings;
    }

    public setVideoSettings(videoSettings: VideoSettings): void {
        this.videoSettings = videoSettings;
    }

    public getScreenInfo(): ScreenInfo | undefined {
        return this.screenInfo;
    }

    public setScreenInfo(screenInfo: ScreenInfo): void {
        console.log(`${this.TAG}.setScreenInfo(${screenInfo})`);
        this.pause();
        this.screenInfo = screenInfo;
    }
}
