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
    private static DEFAULT_FRAMES_PER_FRAGMENT: number = 1;
    private static DEFAULT_FRAMES_PER_SECOND: number = 60;
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

    constructor(protected tag: HTMLVideoElement, private fpf: number = NativeDecoder.DEFAULT_FRAMES_PER_FRAGMENT) {
        super(tag);
        tag.onerror = function(e: Event | string): void {
            console.error(e);
        };
        tag.oncontextmenu = function(e: MouseEvent): boolean {
            e.preventDefault();
            return false;
        };
    }

    private static createConverter(tag: HTMLVideoElement,
                            fps: number = NativeDecoder.DEFAULT_FRAMES_PER_SECOND,
                            fpf: number = NativeDecoder.DEFAULT_FRAMES_PER_FRAGMENT): VideoConverter {
        console.log(`Create new VideoConverter(fps=${fps}, fpf=${fpf})`);
        return new VideoConverter(tag, fps, fpf);
    }

    public play(): void {
        super.play();
        if (this.getState() !== Decoder.STATE.PLAYING || !this.screenInfo) {
            return;
        }
        if (!this.converter) {
            let fps = NativeDecoder.DEFAULT_FRAMES_PER_SECOND;
            if (this.videoSettings) {
                fps = this.videoSettings.frameRate;
            }
            this.converter = NativeDecoder.createConverter(this.tag, fps, this.fpf);
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
            const state = this.getState();
            if (this.converter) {
                this.stop();
                this.converter = NativeDecoder.createConverter(this.tag, videoSettings.frameRate, this.fpf);
            }
            if (state === Decoder.STATE.PLAYING) {
                this.play();
            }
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
