import Decoder from "./Decoder";
import ScreenInfo from "../ScreenInfo";
import VideoSettings from "../VideoSettings";

export default abstract class CanvasCommon extends Decoder {
    protected framesList: Uint8Array[] = [];
    protected canvas?: any;

    public static hasWebGLSupport(): boolean {
        // For some reason if I use here `this.tag` image on canvas will be flattened
        const testCanvas: HTMLCanvasElement = document.createElement('canvas');
        const validContextNames = ["webgl", "experimental-webgl", "moz-webgl", "webkit-3d"];
        let index = 0;
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

    constructor(protected tag: HTMLCanvasElement) {
        super(tag);
    }

    protected abstract decode(data: Uint8Array): void;
    public abstract getPreferredVideoSetting(): VideoSettings;

    private shiftFrame = (): void => {
        this.updateFps(false);
        if (this.getState() !== Decoder.STATE.PLAYING) {
            return;
        }

        const frame = this.framesList.shift();

        if (frame) {
            this.decode(frame);
            this.updateFps(true);
        }
        requestAnimationFrame(this.shiftFrame);
    };

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
        this.tag.onerror = function(e: Event | string): void {
            console.error(e);
        };
        this.tag.oncontextmenu = function(e: MouseEvent): void {
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
            const {width, height} = this.screenInfo.videoSize;
            this.initCanvas(width, height);
        }
        requestAnimationFrame(this.shiftFrame);
    }

    public stop(): void {
        super.stop();
        this.clearState();
    }

    public setScreenInfo(screenInfo: ScreenInfo): void {
        super.setScreenInfo(screenInfo);
        this.clearState();
        const {width, height} = screenInfo.videoSize;
        this.initCanvas(width, height);
    }

    public pushFrame(frame: Uint8Array): void {
        if (Decoder.isIFrame(frame)) {
            if (this.videoSettings) {
                const {frameRate} = this.videoSettings;
                if (this.framesList.length > frameRate / 2) {
                    console.log(this.TAG, 'Dropping frames', this.framesList.length);
                    this.framesList = [];
                }
            }
        }
        this.framesList.push(frame);
    }

    protected clearState(): void {
        this.framesList = [];
    }
}
