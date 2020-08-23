import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Rect from '../Rect';
import Size from '../Size';
import Util from '../Util';

interface BitrateStat {
    timestamp: number;
    bytes: number
}

interface FramesPerSecondStats {
    avgInput: number;
    avgDecoded: number;
    avgDropped: number;
    avgSize: number
}

export interface PlaybackQuality {
    decodedFrames: number;
    droppedFrames: number;
    inputFrames: number;
    inputBytes: number;
    timestamp: number;
}

export interface VideoResizeListener {
    onVideoResize(size: Size): void;
}

export default abstract class Decoder {
    private static readonly STAT_BACKGROUND: string = 'rgba(0, 0, 0, 0.5)';
    private static readonly STAT_TEXT_COLOR: string = 'hsl(24, 85%, 50%)';
    public static readonly DEFAULT_SHOW_QUALITY_STATS = false;
    public static STATE: Record<string, number> = {
        PLAYING: 1,
        PAUSED: 2,
        STOPPED: 3,
    };
    private static STATS_HEIGHT = 12;
    protected screenInfo?: ScreenInfo;
    protected videoSettings: VideoSettings;
    protected parentElement?: HTMLElement;
    protected touchableCanvas: HTMLCanvasElement;
    protected inputBytes: BitrateStat[] = [];
    protected perSecondQualityStats?: FramesPerSecondStats;
    protected momentumQualityStats?: PlaybackQuality;
    private totalStats: PlaybackQuality = {
        decodedFrames: 0,
        droppedFrames: 0,
        inputFrames: 0,
        inputBytes: 0,
        timestamp: 0,
    };
    private totalStatsCounter = 0;
    private dirtyStatsWidth = 0;
    private state: number = Decoder.STATE.STOPPED;
    private resizeListeners: Set<VideoResizeListener> = new Set();
    private showQualityStats = Decoder.DEFAULT_SHOW_QUALITY_STATS;
    private statLines: string[] = [];
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
        const { crop, bitrate, iFrameInterval, sendFrameMeta, lockedVideoOrientation } = parsed;

        // REMOVE `frameRate`
        const maxFps = isNaN(parsed.maxFps) ? parsed.frameRate : parsed.maxFps;
        // REMOVE `maxSize`
        let bounds: Size | null = null;
        if (typeof parsed.bounds !== 'object' || isNaN(parsed.bounds.width) || isNaN(parsed.bounds.height)) {
            if (!isNaN(parsed.maxSize)) {
                bounds = new Size(parsed.maxSize, parsed.maxSize);
            }
        } else {
            bounds = new Size(parsed.bounds.width, parsed.bounds.height);
        }
        return new VideoSettings({
            crop: crop ? new Rect(crop.left, crop.top, crop.right, crop.bottom) : preferred.crop,
            bitrate: !isNaN(bitrate) ? bitrate : preferred.bitrate,
            bounds: bounds !== null ? bounds : preferred.bounds,
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
        requestAnimationFrame(this.updateQualityStats);
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

    public pushFrame(frame: Uint8Array): void {
        this.inputBytes.push({
            timestamp: Date.now(),
            bytes: frame.byteLength
        });
    };

    public abstract getPreferredVideoSetting(): VideoSettings;
    protected abstract calculateMomentumStats(): void;

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
        this.resetStats();
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

    protected resetStats(): void {
        this.totalStatsCounter = 0;
        this.totalStats = {
            droppedFrames: 0,
            decodedFrames: 0,
            inputFrames: 0,
            inputBytes: 0,
            timestamp: 0,
        };
        this.perSecondQualityStats = {
            avgDecoded: 0,
            avgDropped: 0,
            avgInput: 0,
            avgSize: 0,
        };
    }

    private updateQualityStats = (): void => {
        const now = Date.now();
        const oneSecondBefore = now - 1000;
        this.calculateMomentumStats();
        if (!this.momentumQualityStats) {
            return;
        }
        if (this.totalStats.timestamp < oneSecondBefore) {
            this.totalStats = {
                timestamp: now,
                decodedFrames: this.totalStats.decodedFrames + this.momentumQualityStats.decodedFrames,
                droppedFrames: this.totalStats.droppedFrames + this.momentumQualityStats.droppedFrames,
                inputFrames: this.totalStats.inputFrames + this.momentumQualityStats.inputFrames,
                inputBytes: this.totalStats.inputBytes + this.momentumQualityStats.inputBytes,
            };

            if (this.totalStatsCounter !== 0) {
                this.perSecondQualityStats = {
                    avgDecoded: this.totalStats.decodedFrames / this.totalStatsCounter,
                    avgDropped: this.totalStats.droppedFrames / this.totalStatsCounter,
                    avgInput: this.totalStats.inputFrames / this.totalStatsCounter,
                    avgSize: this.totalStats.inputBytes / this.totalStatsCounter,
                };
            }
            this.totalStatsCounter++;
        }
        this.drawStats();
        requestAnimationFrame(this.updateQualityStats);
    };

    private drawStats(): void {
        if (!this.showQualityStats) {
            return;
        }
        const ctx = this.touchableCanvas.getContext('2d');
        if (!ctx) {
            return;
        }
        if (this.perSecondQualityStats && this.momentumQualityStats) {
            const { decodedFrames, droppedFrames, inputBytes, inputFrames } = this.momentumQualityStats;
            const { avgDecoded, avgDropped, avgSize, avgInput } = this.perSecondQualityStats;
            const padInput = inputFrames.toString().padStart(3, ' ');
            const padDecoded = decodedFrames.toString().padStart(3, ' ');
            const padDropped = droppedFrames.toString().padStart(3, ' ');
            const padAvgDecoded = avgDecoded.toFixed(1).padStart(5, ' ');
            const padAvgDropped = avgDropped.toFixed(1).padStart(5, ' ');
            const padAvgInput = avgInput.toFixed(1).padStart(5, ' ');
            const prettyBytes = Util.prettyBytes(inputBytes).padStart(8, ' ');
            const prettyAvgBytes = Util.prettyBytes(avgSize).padStart(8, ' ');

            const newStats = [];
            newStats.push(`Input bytes: ${prettyBytes} (avg: ${prettyAvgBytes}/s)`);
            newStats.push(`Input   FPS: ${padInput} (avg: ${padAvgInput})`);
            newStats.push(`Dropped FPS: ${padDropped} (avg: ${padAvgDropped})`);
            newStats.push(`Decoded FPS: ${padDecoded} (avg: ${padAvgDecoded})`);

            let changed = false;
            newStats.forEach((statLine, id) => {
                if (statLine !== this.statLines[id]) {
                    changed = true;
                }
            })

            if (changed) {
                this.statLines = newStats;
                this.updateCanvas(false);
            }
        }
    }

    private updateCanvas(onlyClear: boolean): void {
        const ctx = this.touchableCanvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const y = this.touchableCanvas.height;
        const height = Decoder.STATS_HEIGHT;
        const lines = this.statLines.length;
        const spaces = lines + 1;
        const p = height / 2;
        const d = p * 2;
        const totalHeight = height * lines + p * spaces;

        ctx.clearRect(0, y - totalHeight, this.dirtyStatsWidth + d, totalHeight);
        this.dirtyStatsWidth = 0;

        if (onlyClear) {
            return;
        }
        ctx.save();
        ctx.font = `${height}px monospace`;
        this.statLines.forEach(text => {
            const textMetrics = ctx.measureText(text);
            const dirty = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
            this.dirtyStatsWidth = Math.max(dirty, this.dirtyStatsWidth);
        })
        ctx.fillStyle = Decoder.STAT_BACKGROUND;
        ctx.fillRect(0, y - totalHeight, this.dirtyStatsWidth + d, totalHeight);
        ctx.fillStyle = Decoder.STAT_TEXT_COLOR;
        this.statLines.forEach((text, line) => {
            ctx.fillText(text, p, y - p - line * (height + p));
        });
        ctx.restore();
    }

    public setShowQualityStats(value: boolean) {
        this.showQualityStats = value;
        if (!value) {
            this.updateCanvas(true);
        } else {
            this.drawStats();
        }
    }

    public getShowQualityStats(): boolean {
        return this.showQualityStats;
    }
}
