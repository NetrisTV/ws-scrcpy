import Decoder from './Decoder';
import Size from '../Size';
import YUVCanvas from '../h264-live-player/YUVCanvas';
import YUVWebGLCanvas from '../h264-live-player/YUVWebGLCanvas';
// @ts-ignore
import Avc from '../Decoder';
import VideoSettings from '../VideoSettings';
import Canvas from '../h264-live-player/Canvas';
import ScreenInfo from '../ScreenInfo';

export const CANVAS_TYPE: Record<string, string> = {
    WEBGL: 'webgl',
    YUV: 'YUVWebGLCanvas',
    CANVAS: 'YUVCanvas'
};

export class BroadwayDecoder extends Decoder {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 500000,
        frameRate: 24,
        iFrameInterval: 5,
        maxSize: 480,
        sendFrameMeta: false
    });
    public static createElement(id?: string): HTMLCanvasElement {
        const tag = document.createElement('canvas') as HTMLCanvasElement;
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        return tag;
    }
    protected TAG: string = 'BroadwayDecoder';
    private avc?: Avc;
    private canvas?: Canvas;
    private framesList: Uint8Array[] = [];

    constructor(protected tag: HTMLCanvasElement, private canvastype: string) {
        super(tag);
        this.avc = new Avc();
    }

    private static isIFrame(frame: Uint8Array): boolean {
        return frame && frame.length > 4 && frame[4] === 0x65;
    }

    protected initCanvas(width: number, height: number): void {
        const canvasFactory = this.canvastype === 'webgl' || this.canvastype === 'YUVWebGLCanvas'
            ? YUVWebGLCanvas
            : YUVCanvas;
        if (this.canvas) {
            const parent = this.tag.parentNode;
            if (parent) {
                const tag = BroadwayDecoder.createElement(this.tag.id);
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
        this.canvas = new canvasFactory(this.tag, new Size(width, height));
        this.avc = new Avc();
        this.avc.onPictureDecoded = this.canvas.decode.bind(this.canvas);
        this.tag.width = width;
        this.tag.height = height;
        // if (this.parentElement) {
        //     this.parentElement.style.height = `${height}px`;
        //     this.parentElement.style.width = `${width}px`;
        // }
    }

    private shiftFrame(): void {
        this.updateFps(false);
        if (this.getState() !== Decoder.STATE.PLAYING) {
            return;
        }

        const frame = this.framesList.shift();

        if (frame) {
            this.decode(frame);
            this.updateFps(true);
        }
        requestAnimationFrame(this.shiftFrame.bind(this));
    }

    public decode(data: Uint8Array): void {
        // let naltype = 'invalid frame';
        //
        // if (data.length > 4) {
        //     if (data[4] == 0x65) {
        //         naltype = 'I frame';
        //     } else if (data[4] == 0x41) {
        //         naltype = 'P frame';
        //     } else if (data[4] == 0x67) {
        //         naltype = 'SPS';
        //     } else if (data[4] == 0x68) {
        //         naltype = 'PPS';
        //     }
        // }
        // log('Passed ' + naltype + ' to decoder');
        this.avc.decode(data);
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
        requestAnimationFrame(this.shiftFrame.bind(this));
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

    public getPreferredVideoSetting(): VideoSettings {
        return BroadwayDecoder.preferredVideoSettings;
    }

    public pushFrame(frame: Uint8Array): void {
        if (BroadwayDecoder.isIFrame(frame)) {
            if (this.videoSettings) {
                const {frameRate} = this.videoSettings;
                if (this.framesList.length > frameRate / 2) {
                    console.log('Dropping frames', this.framesList.length);
                    this.framesList = [];
                }
            }
        }
        this.framesList.push(frame);
    }

    private clearState(): void {
        this.framesList = [];
    }
}
