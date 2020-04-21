import Decoder from './Decoder';
import VideoConverter from 'h264-converter';
import VideoSettings from '../VideoSettings';

export default class NativeDecoder extends Decoder {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 8000000,
        frameRate: 60,
        iFrameInterval: 10,
        maxSize: 720,
        sendFrameMeta: false
    });
    private static DEFAULT_FRAME_PER_FRAGMENT: number = 6;
    public static createElement(id?: string): HTMLVideoElement {
        const tag = document.createElement('video') as HTMLVideoElement;
        tag.setAttribute('muted', 'muted');
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        return tag;
    }
    protected TAG: string = 'NativeDecoder';
    private converter?: VideoConverter;

    constructor(protected tag: HTMLVideoElement, private fpf: number = NativeDecoder.DEFAULT_FRAME_PER_FRAGMENT) {
        super(tag);
        tag.onerror = function(e: Event | string): void {
            console.error(e);
        };
        tag.oncontextmenu = function(e: MouseEvent): boolean {
            e.preventDefault();
            return false;
        };
    }

    public play(): void {
        super.play();
        if (this.getState() !== Decoder.STATE.PLAYING || !this.screenInfo) {
            return;
        }
        if (!this.converter) {
            const fps = 60;
            // for some reason stream work only with fps === 60
            // if (this.videoSettings) {
            //     fps = this.videoSettings.frameRate;
            // }
            const fpf = this.fpf;
            console.log(`Create new VideoConverter(fps=${fps}, fpf=${fpf})`);
            this.converter = new VideoConverter(this.tag, fps, fpf);
        }
        this.converter.play();
    }

    public pause(): void {
        super.pause();
        this.stopConverter();
    }

    public stop(): void {
        super.stop();
        this.stopConverter();
    }

    public setVideoSettings(videoSettings: VideoSettings): void {
        if (this.videoSettings && this.videoSettings.frameRate !== videoSettings.frameRate) {
            // if it was actual frameRate we will need to create new VideoConverter
        }
        this.videoSettings = videoSettings;
    }

    public getPreferredVideoSetting(): VideoSettings {
        return NativeDecoder.preferredVideoSettings;
    }

    public pushFrame(frame: Uint8Array): void {
        if (this.converter) {
            this.converter.appendRawData(frame);
        }
    }

    private stopConverter(): void {
        if (this.converter) {
            this.converter.appendRawData(new Uint8Array([]));
            this.converter.pause();
            delete this.converter;
        }
    }
}
