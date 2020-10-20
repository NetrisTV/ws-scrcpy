import MseDecoder from './MseDecoder';
import ScreenInfo from '../ScreenInfo';
import Rect from '../Rect';
import Size from '../Size';
import VideoSettings from '../VideoSettings';

export class Mse4QVHackDecoder extends MseDecoder {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 8000000,
        maxFps: 30,
        iFrameInterval: 10,
        bounds: new Size(720, 720),
        sendFrameMeta: false,
    });

    constructor(udid: string, tag: HTMLVideoElement) {
        super(udid, tag);
    }

    protected onCanPlayHandler(): void {
        super.onCanPlayHandler();
        const tag = this.tag;
        const { videoWidth, videoHeight } = tag;
        if (!videoWidth && !videoHeight) {
            return;
        }
        let w = videoWidth;
        let h = videoHeight;
        if (this.bounds) {
            let { w: boundsWidth, h: boundsHeight } = this.bounds;
            if (w > boundsWidth || h > boundsHeight) {
                let scaledHeight;
                let scaledWidth;
                if (boundsWidth > w) {
                    scaledHeight = h;
                } else {
                    scaledHeight = (boundsWidth * h) / w;
                }
                if (boundsHeight > scaledHeight) {
                    boundsHeight = scaledHeight;
                }
                if (boundsHeight == h) {
                    scaledWidth = w;
                } else {
                    scaledWidth = (boundsHeight * w) / h;
                }
                if (boundsWidth > scaledWidth) {
                    boundsWidth = scaledWidth;
                }
                w = boundsWidth | 0;
                h = boundsHeight | 0;
                tag.style.maxWidth = `${w}px`;
                tag.style.maxHeight = `${h}px`;
            }
        }
        const realScreen = new ScreenInfo(new Rect(0, 0, videoWidth, videoHeight), new Size(w, h), 0);
        this.emit('input-video-resize', realScreen);
        this.setScreenInfo(new ScreenInfo(new Rect(0, 0, w, h), new Size(w, h), 0));
    }

    protected needScreenInfoBeforePlay(): boolean {
        return false;
    }

    public getPreferredVideoSetting(): VideoSettings {
        return Mse4QVHackDecoder.preferredVideoSettings;
    }

    public setVideoSettings(): void {
        return;
    }

    public play(): void {
        super.play();
        this.tag.oncanplay = this.onVideoCanPlay;
    }
}
