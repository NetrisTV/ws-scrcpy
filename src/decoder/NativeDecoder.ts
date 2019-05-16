import Decoder from "./Decoder";
import VideoConverter from "h264-converter";

export default class NativeDecoder extends Decoder {
    static readonly DEFAULT_FRAME_PER_FRAGMENT = 6;
    private converter?: VideoConverter;

    constructor(protected tag: HTMLVideoElement, private fpf: number = NativeDecoder.DEFAULT_FRAME_PER_FRAGMENT) {
        super(tag);
        tag.onerror = function (e) {
            console.error(e);
        };
        tag.oncontextmenu = function (e) {
            e.preventDefault();
            return false;
        };
    }

    play() {
        if (!this.streamInfo) {
            return;
        }
        if (!this.converter) {
            const fps = this.streamInfo.frameRate;
            const fpf = this.fpf;
            console.log(`Create new VideoConverter(fps=${fps}, fpf=${fpf})`);
            this.converter = new VideoConverter(this.tag, fps, fpf);
        }
        this.converter.play();
    }

    pause() {
        if (this.converter) {
            this.converter.appendRawData(new Uint8Array([]));
            this.converter.pause();
            delete this.converter;
        }
    }

    pushFrame(frame: Uint8Array) {
        if (this.converter) {
            this.converter.appendRawData(frame);
        }
    }
}
