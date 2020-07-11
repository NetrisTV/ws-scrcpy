import Size from '../Size';
import YUVCanvas from '../h264-live-player/YUVCanvas';
import YUVWebGLCanvas from '../h264-live-player/YUVWebGLCanvas';
// @ts-ignore
import Avc from '../Decoder';
import VideoSettings from '../VideoSettings';
import Canvas from '../h264-live-player/Canvas';
import CanvasCommon from "./CanvasCommon";

export class BroadwayDecoder extends CanvasCommon {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 500000,
        frameRate: 24,
        iFrameInterval: 5,
        maxSize: 480,
        sendFrameMeta: false
    });

    protected TAG: string = 'BroadwayDecoder';
    protected canvas?: Canvas;
    private avc?: Avc;
    public readonly supportsScreenshot: boolean = true;

    constructor(protected tag: HTMLCanvasElement) {
        super(tag);
        this.avc = new Avc();
    }

    protected initCanvas(width: number, height: number): void {
        super.initCanvas(width, height);
        if (CanvasCommon.hasWebGLSupport()) {
            this.canvas = new YUVWebGLCanvas(this.tag, new Size(width, height));
        } else {
            this.canvas = new YUVCanvas(this.tag, new Size(width, height));
        }
        this.avc = new Avc();
        this.avc.onPictureDecoded = this.canvas.decode.bind(this.canvas);
    }

    protected decode(data: Uint8Array): void {
        this.avc.decode(data);
    }

    public getPreferredVideoSetting(): VideoSettings {
        return BroadwayDecoder.preferredVideoSettings;
    }
}
