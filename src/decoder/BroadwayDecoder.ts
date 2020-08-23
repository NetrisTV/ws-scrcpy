import Size from '../Size';
import YUVCanvas from '../h264-live-player/YUVCanvas';
import YUVWebGLCanvas from '../h264-live-player/YUVWebGLCanvas';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Avc from '../Decoder';
import VideoSettings from '../VideoSettings';
import Canvas from '../h264-live-player/Canvas';
import CanvasCommon from './CanvasCommon';

export default class BroadwayDecoder extends CanvasCommon {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 500000,
        maxFps: 24,
        iFrameInterval: 5,
        bounds: new Size(480, 480),
        sendFrameMeta: false,
    });

    protected canvas?: Canvas;
    private avc?: Avc;
    public readonly supportsScreenshot: boolean = true;

    constructor(udid: string) {
        super(udid, 'BroadwayDecoder');
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
        this.avc.onPictureDecoded = (buffer: Uint8Array, width: number, height: number) => {
            this.onFrameDecoded();
            if (this.canvas) {
                this.canvas.decode(buffer, width, height);
            }
        }
    }

    protected decode(data: Uint8Array): void {
        this.avc.decode(data);
    }

    public getPreferredVideoSetting(): VideoSettings {
        return BroadwayDecoder.preferredVideoSettings;
    }
}
