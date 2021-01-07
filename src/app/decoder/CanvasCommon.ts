import Decoder, { PlaybackQuality } from './Decoder';
import ScreenInfo from '../ScreenInfo';
import VideoSettings from '../VideoSettings';

type DecodedFrame = {
    width: number;
    height: number;
    buffer: Uint8Array;
};

interface CanvasDecoder {
    decode(buffer: Uint8Array, width: number, height: number): void;
}

export default abstract class CanvasCommon extends Decoder {
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
            } catch (e) {
                gl = null;
            }
        }
        console.log('WebGL support:' + !!gl);
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

    constructor(udid: string, name = 'Canvas', protected tag: HTMLCanvasElement = CanvasCommon.createElement()) {
        super(udid, name, tag);
    }

    protected abstract decode(data: Uint8Array): void;
    public abstract getPreferredVideoSetting(): VideoSettings;

    protected drawDecoded = (): void => {
        if (!this.canvas) {
            return;
        }
        if (this.decodedFrames.length) {
            const last = this.decodedFrames.pop();
            if (last && this.canvas) {
                const { buffer, width, height } = last;
                this.canvas.decode(buffer, width, height);
            }
        }
        const dropped = this.decodedFrames.length;
        if (dropped > 0) {
            this.decodedFrames.length = 0;
            this.videoStats.push({
                decodedFrames: 0,
                droppedFrames: dropped,
                inputBytes: 0,
                inputFrames: 0,
                timestamp: Date.now(),
            });
        }
        delete this.animationFrameId;
    };

    protected onFrameDecoded(): void {
        this.videoStats.push({
            decodedFrames: 1,
            droppedFrames: 0,
            inputBytes: 0,
            inputFrames: 0,
            timestamp: Date.now(),
        });
        if (!this.animationFrameId) {
            this.animationFrameId = requestAnimationFrame(this.drawDecoded);
        }
    }

    private shiftFrame(): void {
        if (this.getState() !== Decoder.STATE.PLAYING) {
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
                const tag = CanvasCommon.createElement(this.tag.id);
                tag.className = this.tag.className;
                parent.replaceChild(tag, this.tag);
                parent.appendChild(this.touchableCanvas);
                this.tag = tag;
            }
        }
        this.tag.onerror = function (e: Event | string): void {
            console.error(e);
        };
        this.tag.oncontextmenu = function (e: MouseEvent): void {
            e.preventDefault();
        };
        this.tag.width = width;
        this.tag.height = height;
    }

    public play(): void {
        super.play();
        if (this.getState() !== Decoder.STATE.PLAYING || !this.screenInfo) {
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
    }

    public pushFrame(frame: Uint8Array): void {
        super.pushFrame(frame);
        if (Decoder.isIFrame(frame)) {
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
