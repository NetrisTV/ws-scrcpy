import { BasePlayer } from './BasePlayer';
import VideoSettings from '../VideoSettings';
import { DisplayInfo } from '../DisplayInfo';

export class MjpegPlayer extends BasePlayer {
    private static dummyVideoSettings = new VideoSettings();
    public static storageKeyPrefix = 'MjpegDecoder';
    public static playerFullName = 'Mjpeg Http Player';
    public static playerCodeName = 'mjpeghttp';

    public static createElement(id?: string): HTMLImageElement {
        const tag = document.createElement('img') as HTMLImageElement;
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        return tag;
    }

    public static isSupported(): boolean {
        // I guess everything supports MJPEG?
        return true;
    }

    public readonly supportsScreenshot = true;
    public readonly resizeVideoToBounds: boolean = true;

    constructor(
        udid: string,
        displayInfo?: DisplayInfo,
        name = 'MJPEG_Player',
        storageKeyPrefix = 'MJPEG',
        protected tag: HTMLImageElement = MjpegPlayer.createElement(),
    ) {
        super(udid, displayInfo, name, storageKeyPrefix, tag);
        this.tag.onload = () => {
            this.checkVideoResize();
        };
    }

    public play(): void {
        super.play();
        this.tag.setAttribute('src', `${location.protocol}//${location.host}/mjpeg/${this.udid}`);
    }

    public pause(): void {
        super.pause();
        this.tag.removeAttribute('src');
    }

    public stop(): void {
        super.stop();
        this.tag.removeAttribute('src');
    }

    protected needScreenInfoBeforePlay(): boolean {
        return false;
    }

    protected calculateMomentumStats(): void {
        // not implemented
    }

    getFitToScreenStatus(): boolean {
        return false;
    }

    getImageDataURL(): string {
        const canvas = document.createElement('canvas');
        canvas.width = this.videoWidth;
        canvas.height = this.videoHeight;
        canvas.getContext('2d')?.drawImage(this.tag, 0, 0);
        return canvas.toDataURL('image/png');
    }

    getPreferredVideoSetting(): VideoSettings {
        return MjpegPlayer.dummyVideoSettings;
    }

    loadVideoSettings(): VideoSettings {
        return MjpegPlayer.dummyVideoSettings;
    }

    checkVideoResize = (): void => {
        if (!this.tag) {
            return;
        }
        const { height, width } = this.tag;
        if (this.videoHeight !== height || this.videoWidth !== width) {
            this.calculateScreenInfoForBounds(width, height);
        }
    };
}
