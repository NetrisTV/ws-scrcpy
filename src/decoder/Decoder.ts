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
    protected parentElement?: HTMLElement;
    protected touchableCanvas: HTMLCanvasElement;
    private state: number = Decoder.STATE.STOPPED;

    protected constructor(protected tag: HTMLElement) {
        this.touchableCanvas = document.createElement('canvas');
        this.touchableCanvas.className = 'touch-layer';
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

    public getTouchableElement(): HTMLElement {
        return this.touchableCanvas;
    }

    public setParent(parent: HTMLElement): void {
        this.parentElement = parent;
        parent.append(this.tag);
        parent.append(this.touchableCanvas);
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
        const {width, height} = screenInfo.videoSize;
        this.touchableCanvas.width = width;
        this.touchableCanvas.height = height;
        if (this.parentElement) {
            this.parentElement.style.height = `${height}px`;
            this.parentElement.style.width = `${width}px`;
        }
    }

    public getName(): string {
        return this.TAG;
    }
}
