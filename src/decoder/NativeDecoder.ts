import Decoder from './Decoder';
import VideoConverter from 'h264-converter';

export default class NativeDecoder extends Decoder {
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
        if (!this.streamInfo) {
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
        if (this.converter) {
            this.converter.appendRawData(new Uint8Array([]));
            this.converter.pause();
            delete this.converter;
        }
    }

    public pushFrame(frame: Uint8Array): void {
        if (this.converter) {
            this.converter.appendRawData(frame);
        }
    }
}
