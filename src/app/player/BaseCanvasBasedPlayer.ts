import { BasePlayer, PlaybackQuality } from './BasePlayer';
import ScreenInfo from '../ScreenInfo';
import VideoSettings from '../VideoSettings';
import { DisplayInfo } from '../DisplayInfo';

type DecodedFrame = {
    width: number;
    height: number;
    frame: any;
};

interface CanvasDecoder {
    decode(buffer: Uint8Array, width: number, height: number): void;
}

export abstract class BaseCanvasBasedPlayer extends BasePlayer {
    protected framesList: Uint8Array[] = [];
    protected decodedFrames: DecodedFrame[] = [];
    protected videoStats: PlaybackQuality[] = [];
    protected animationFrameId?: number;
    protected canvas?: CanvasDecoder;

    public static hasWebGLSupport(): boolean {
        // For some reason if I use here `this.tag` image on canvas will be flattened
        const testCanvas: HTMLCanvasElement = document.createElement('canvas');
        const validContextNames = ['webgl', 'experimental-webgl', 'moz-webgl', 'webkit-3d'];
        let index = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let gl: any = null;
        while (!gl && index++ < validContextNames.length) {
            try {
                gl = testCanvas.getContext(validContextNames[index]);
            } catch (error: any) {
                gl = null;
            }
        }
        return !!gl;
    }

    public static createElement(id?: string): HTMLCanvasElement {
        const tag = document.createElement('canvas') as HTMLCanvasElement;
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        return tag;
    }

    constructor(
        udid: string,
        displayInfo?: DisplayInfo,
        name = 'Canvas',
        storageKeyPrefix = 'DummyCanvas',
        protected tag: HTMLCanvasElement = BaseCanvasBasedPlayer.createElement(),
    ) {
        super(udid, displayInfo, name, storageKeyPrefix, tag);
    }

    protected abstract decode(data: Uint8Array): void;
    public abstract getPreferredVideoSetting(): VideoSettings;

    protected drawDecoded = (): void => {
        if (!this.canvas) {
            return;
        }
        if (this.receivedFirstFrame) {
            const data = this.decodedFrames.shift();
            if (data) {
                const { frame, width, height } = data;
                this.canvas.decode(frame, width, height);
            }
        }
        if (this.decodedFrames.length) {
            this.animationFrameId = requestAnimationFrame(this.drawDecoded);
        } else {
            this.animationFrameId = undefined;
        }
    };

    protected onFrameDecoded(width: number, height: number, frame: any): void {
        if (!this.receivedFirstFrame) {
            // decoded frame with previous video settings
            return;
        }
        let dropped = 0;
        const maxStored = this.videoSettings.maxFps / 10; // for 100ms

        while (this.decodedFrames.length > maxStored) {
            const data = this.decodedFrames.shift();
            if (data) {
                this.dropFrame(data.frame);
                dropped++;
            }
        }
        this.decodedFrames.push({ width, height, frame });
        this.videoStats.push({
            decodedFrames: 1,
            droppedFrames: dropped,
            inputBytes: 0,
            inputFrames: 0,
            timestamp: Date.now(),
        });
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this.drawDecoded);
        }
    }

    protected dropFrame(_frame: any): void {
        // dispose frame if required
    }

    private shiftFrame(): void {
        if (this.getState() !== BasePlayer.STATE.PLAYING) {
            return;
        }
        const first = this.framesList.shift();
        if (first) {
            this.decode(first);
        }
    }

    protected calculateMomentumStats(): void {
        const timestamp = Date.now();
        const oneSecondBefore = timestamp - 1000;

        while (this.videoStats.length && this.videoStats[0].timestamp < oneSecondBefore) {
            this.videoStats.shift();
        }
        while (this.inputBytes.length && this.inputBytes[0].timestamp < oneSecondBefore) {
            this.inputBytes.shift();
        }
        let decodedFrames = 0;
        let droppedFrames = 0;
        let inputBytes = 0;
        this.videoStats.forEach((item) => {
            decodedFrames += item.decodedFrames;
            droppedFrames += item.droppedFrames;
        });
        this.inputBytes.forEach((item) => {
            inputBytes += item.bytes;
        });
        this.momentumQualityStats = {
            decodedFrames,
            droppedFrames,
            inputFrames: this.inputBytes.length,
            inputBytes,
            timestamp,
        };
    }

    protected resetStats(): void {
        super.resetStats();
        this.videoStats = [];
    }

    public getImageDataURL(): string {
        return this.tag.toDataURL();
    }

    protected initCanvas(width: number, height: number): void {
        if (this.canvas) {
            const parent = this.tag.parentNode;
            if (parent) {
                const tag = BaseCanvasBasedPlayer.createElement(this.tag.id);
                tag.className = this.tag.className;
                parent.replaceChild(tag, this.tag);
                parent.appendChild(this.touchableCanvas);
                this.tag = tag;
            }
        }
        this.tag.onerror = (event: Event | string): void => {
            console.error(`[${this.name}]`, event);
        };
        this.tag.oncontextmenu = (event: MouseEvent): void => {
            event.preventDefault();
        };
        this.tag.width = Math.round(width);
        this.tag.height = Math.round(height);
    }

    public play(): void {
        super.play();
        if (this.getState() !== BasePlayer.STATE.PLAYING || !this.screenInfo) {
            return;
        }
        if (!this.canvas) {
            const { width, height } = this.screenInfo.videoSize;
            this.initCanvas(width, height);
            this.resetStats();
        }
        this.shiftFrame();
    }

    public stop(): void {
        super.stop();
        this.clearState();
    }

    public setScreenInfo(screenInfo: ScreenInfo): void {
        super.setScreenInfo(screenInfo);
        this.clearState();
        const { width, height } = screenInfo.videoSize;
        this.initCanvas(width, height);
        this.framesList = [];
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = undefined;
        }
    }

    public pushFrame(frame: Uint8Array): void {
        super.pushFrame(frame);
        if (BasePlayer.isIFrame(frame)) {
            if (this.videoSettings) {
                const { maxFps } = this.videoSettings;
                if (this.framesList.length > maxFps / 2) {
                    const dropped = this.framesList.length;
                    this.framesList = [];
                    this.videoStats.push({
                        decodedFrames: 0,
                        droppedFrames: dropped,
                        inputBytes: 0,
                        inputFrames: 0,
                        timestamp: Date.now(),
                    });
                }
            }
        }
        this.framesList.push(frame);
        this.shiftFrame();
    }

    protected clearState(): void {
        this.framesList = [];
    }
}
