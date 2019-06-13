import Decoder from './Decoder';
import VideoConverter from 'h264-converter';
import StreamInfo from '../StreamInfo';

export default class NativeDecoder extends Decoder {
    public static readonly preferredStreamSettings: StreamInfo = new StreamInfo({
        bitrate: 8000000,
        frameRate: 60,
        width: 720,
        height: 720
    });
    private static DEFAULT_FRAME_PER_FRAGMENT: number = 6;
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
        if (this.getState() !== Decoder.STATE.PLAYING || !this.streamInfo) {
            return;
        }
        if (!this.converter) {
            const fps = 60 /*this.streamInfo.frameRate*/;
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

    public getPreferredStreamSetting(): StreamInfo {
        return NativeDecoder.preferredStreamSettings;
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
