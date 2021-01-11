import '../../../vendor/Broadway/avc.wasm.asset';
import Size from '../Size';
import YUVCanvas from '../h264-live-player/YUVCanvas';
import YUVWebGLCanvas from '../h264-live-player/YUVWebGLCanvas';
import Avc from '../../../vendor/Broadway/Decoder';
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
    }

    protected initCanvas(width: number, height: number): void {
        super.initCanvas(width, height);
        if (CanvasCommon.hasWebGLSupport()) {
            this.canvas = new YUVWebGLCanvas(this.tag, new Size(width, height));
        } else {
            this.canvas = new YUVCanvas(this.tag, new Size(width, height));
        }
        if (!this.avc) {
            this.avc = new Avc();
        }
        this.avc.onPictureDecoded = (buffer: Uint8Array, width: number, height: number) => {
            this.onFrameDecoded(width, height, buffer);
        };
    }

    protected decode(data: Uint8Array): void {
        if (!this.avc) {
            return;
        }
        this.avc.decode(data);
    }

    public getPreferredVideoSetting(): VideoSettings {
        return BroadwayDecoder.preferredVideoSettings;
    }
}
