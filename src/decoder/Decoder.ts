import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Rect from '../Rect';
import Size from '../Size';

export interface VideoResizeListener {
    onVideoResize(size: Size): void;
}

export default abstract class Decoder {
    public static STATE: Record<string, number> = {
        PLAYING: 1,
        PAUSED: 2,
        STOPPED: 3,
    };
    protected screenInfo?: ScreenInfo;
    protected videoSettings: VideoSettings;
    protected parentElement?: HTMLElement;
    protected touchableCanvas: HTMLCanvasElement;
    protected fpsCurrentValue = 0;
    protected fpsCounter: number[] = [];
    private state: number = Decoder.STATE.STOPPED;
    private resizeListeners: Set<VideoResizeListener> = new Set();
    public showFps = true;
    public readonly supportsScreenshot: boolean = false;

    constructor(
        protected udid: string,
        protected name: string = 'Decoder',
        protected tag: HTMLElement = document.createElement('div'),
    ) {
        this.touchableCanvas = document.createElement('canvas');
        this.touchableCanvas.className = 'touch-layer';
        this.touchableCanvas.oncontextmenu = function (e: MouseEvent): void {
            e.preventDefault();
        };
        const preferred = this.getPreferredVideoSetting();
        this.videoSettings = Decoder.getVideoSettingFromStorage(preferred, this.name, udid);
    }

    protected static isIFrame(frame: Uint8Array): boolean {
        return frame && frame.length > 4 && frame[4] === 0x65;
    }

    private static getStorageKey(decoderName: string, udid: string): string {
        const { innerHeight, innerWidth } = window;
        return `${decoderName}:${udid}:${innerWidth}x${innerHeight}`;
    }

    private static getVideoSettingFromStorage(
        preferred: VideoSettings,
        decoderName: string,
        deviceName: string,
    ): VideoSettings {
        if (!window.localStorage) {
            return preferred;
        }
        const key = this.getStorageKey(decoderName, deviceName);
        const saved = window.localStorage.getItem(key);
        if (!saved) {
            return preferred;
        }
        const parsed = JSON.parse(saved);
        const { crop, bitrate, maxSize, iFrameInterval, sendFrameMeta, lockedVideoOrientation } = parsed;

        // REMOVE `frameRate`
        const maxFps = isNaN(parsed.maxFps) ? parsed.frameRate : parsed.maxFps;
        return new VideoSettings({
            crop: crop ? new Rect(crop.left, crop.top, crop.right, crop.bottom) : preferred.crop,
            bitrate: !isNaN(bitrate) ? bitrate : preferred.bitrate,
            maxSize: !isNaN(maxSize) ? maxSize : preferred.maxSize,
            maxFps: !isNaN(maxFps) ? maxFps : preferred.maxFps,
            iFrameInterval: !isNaN(iFrameInterval) ? iFrameInterval : preferred.iFrameInterval,
            sendFrameMeta: typeof sendFrameMeta === 'boolean' ? sendFrameMeta : preferred.sendFrameMeta,
            lockedVideoOrientation: !isNaN(lockedVideoOrientation)
                ? lockedVideoOrientation
                : preferred.lockedVideoOrientation,
        });
    }

    private static putVideoSettingsToStorage(
        decoderName: string,
        deviceName: string,
        videoSettings: VideoSettings,
    ): void {
        if (!window.localStorage) {
            return;
        }
        const key = this.getStorageKey(decoderName, deviceName);
        window.localStorage.setItem(key, JSON.stringify(videoSettings));
    }

    public abstract getImageDataURL(): string;

    public createScreenshot(deviceName: string): void {
        const a = document.createElement('a');
        a.href = this.getImageDataURL();
        a.download = `${deviceName} ${new Date().toLocaleString()}.png`;
        a.click();
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
        parent.appendChild(this.tag);
        parent.appendChild(this.touchableCanvas);
    }

    public getVideoSettings(): VideoSettings {
        return this.videoSettings;
    }

    public setVideoSettings(videoSettings: VideoSettings, saveToStorage: boolean): void {
        this.videoSettings = videoSettings;
        if (saveToStorage) {
            Decoder.putVideoSettingsToStorage(this.name, this.udid, videoSettings);
        }
    }

    public getScreenInfo(): ScreenInfo | undefined {
        return this.screenInfo;
    }

    public setScreenInfo(screenInfo: ScreenInfo): void {
        this.pause();
        this.screenInfo = screenInfo;
        const { width, height } = screenInfo.videoSize;
        this.touchableCanvas.width = width;
        this.touchableCanvas.height = height;
        if (this.parentElement) {
            this.parentElement.style.height = `${height}px`;
            this.parentElement.style.width = `${width}px`;
        }
        const size = new Size(width, height);
        this.resizeListeners.forEach((listener) => {
            listener.onVideoResize(size);
        });
    }

    public getName(): string {
        return this.name;
    }

    public addResizeListener(listener: VideoResizeListener) {
        this.resizeListeners.add(listener);
    }

    public removeResizeListener(listener: VideoResizeListener) {
        this.resizeListeners.delete(listener);
    }

    protected updateFps(pushNew: boolean): void {
        const now = Date.now();
        const oneSecondBefore = now - 1000;
        if (pushNew) {
            this.fpsCounter.push(now);
        }
        while (this.fpsCounter.length && this.fpsCounter[0] < oneSecondBefore) {
            this.fpsCounter.shift();
        }
        if (this.fpsCounter.length !== this.fpsCurrentValue) {
            this.fpsCurrentValue = this.fpsCounter.length;
            if (this.showFps) {
                const ctx = this.touchableCanvas.getContext('2d');
                if (ctx) {
                    const height = 12;
                    const y = this.touchableCanvas.height;
                    ctx.clearRect(0, y - height, 40, height);
                    ctx.font = `${height}px monospace`;
                    ctx.fillStyle = 'orange';
                    ctx.fillText(this.fpsCurrentValue.toString(), 0, y);
                }
            }
        }
    }
}
