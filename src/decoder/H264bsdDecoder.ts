import Decoder from './Decoder';
import VideoSettings from '../VideoSettings';
// @ts-ignore
import { H264bsdCanvas } from '../h264bsd_canvas.js';
import ScreenInfo from '../ScreenInfo';
import H264bsdWorker from './H264bsdWorker';

export default class H264bsdDecoder extends Decoder {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 500000,
        frameRate: 24,
        iFrameInterval: 5,
        maxSize: 480,
        sendFrameMeta: false
    });
    public static createElement(id?: string): HTMLCanvasElement {
        const tag = document.createElement('canvas') as HTMLCanvasElement;
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        return tag;
    }
    protected TAG: string = 'H264bsdDecoder';
    private worker?: H264bsdWorker;
    private display?: H264bsdCanvas;
    private framesList: Uint8Array[] = [];
    private running: boolean = false;
    private readonly bindedOnMessage: (e: MessageEvent) => void;

    constructor(protected tag: HTMLCanvasElement) {
        super(tag);
        this.bindedOnMessage = this.onWorkerMessage.bind(this);
    }

    private static isIFrame(frame: Uint8Array): boolean {
        return frame && frame.length > 4 && frame[4] === 0x65;
    }

    private onWorkerMessage(e: MessageEvent): void {
        const message = e.data;
        if (!message.hasOwnProperty('type')) {
            return;
        }
        switch (message.type) {
            // Posted when onHeadersReady is called on the worker
            case 'pictureParams':
                const croppingParams = message.croppingParams;
                if (croppingParams === null) {
                    this.tag.width = message.width;
                    this.tag.height = message.height;
                } else {
                    this.tag.width = croppingParams.width;
                    this.tag.height = croppingParams.height;
                }
                break;

            // Posted when onPictureReady is called on the worker
            case 'pictureReady':
                this.display.drawNextOutputPicture(
                    message.width,
                    message.height,
                    message.croppingParams,
                    new Uint8Array(message.data));
                break;

            // Posted after all of the queued data has been decoded
            case 'noInput':
                break;

            // Posted after the worker creates and configures a decoder
            case 'decoderReady':
                // handled in H264bsdWorker
                break;

            // Error messages that line up with error codes returned by decode()
            case 'decodeError':
            case 'paramSetError':
            case 'memAllocError':
                console.error(e);
                break;
            default:
                throw Error(`Wrong message type "${message.type}"`);
        }
    }

    private initWorker(): void {
        this.worker = H264bsdWorker.getInstance();
        this.worker.worker.addEventListener('message', this.bindedOnMessage);
    }

    private initCanvas(width: number, height: number): void {
        if (this.display) {
            const parent = this.tag.parentNode;
            if (parent) {
                const tag = H264bsdDecoder.createElement(this.tag.id);
                tag.className = this.tag.className;
                parent.replaceChild(tag, this.tag);
                parent.appendChild(this.touchableCanvas);
                this.tag = tag;
            }
        }
        this.display = new H264bsdCanvas(this.tag);
        this.tag.onerror = function(e: Event | string): void {
            console.error(e);
        };
        this.tag.oncontextmenu = function(e: MouseEvent): void {
            e.preventDefault();
        };
        this.tag.width = width;
        this.tag.height = height;
        // if (this.parentElement) {
        //     this.parentElement.style.height = `${height}px`;
        //     this.parentElement.style.width = `${width}px`;
        // }
    }

    private shiftFrame(): void {
        this.updateFps(false);
        if (!this.running) {
            return;
        }

        const frame = this.framesList.shift();

        if (frame) {
            this.decode(frame);
            this.updateFps(true);
        }

        requestAnimationFrame(this.shiftFrame.bind(this));
    }

    private decode(data: Uint8Array): void {
        if (!this.worker || !this.worker.isDecoderReady()) {
            return;
        }
        this.worker.worker.postMessage({
            type: 'queueInput',
            data: data.buffer
        }, [data.buffer]);
    }

    public play(): void {
        super.play();
        if (this.getState() !== Decoder.STATE.PLAYING || !this.screenInfo) {
            return;
        }
        if (!this.display) {
            const {width, height} = this.screenInfo.videoSize;
            this.initCanvas(width, height);
        }
        if (!this.worker) {
            this.initWorker();
        }
        this.running = true;
        requestAnimationFrame(this.shiftFrame.bind(this));
    }

    public stop(): void {
        super.stop();
        this.clearState();
        if (this.worker && this.worker.worker) {
            this.worker.worker.removeEventListener('message', this.bindedOnMessage);
            delete this.worker;
        }
    }

    public setScreenInfo(screenInfo: ScreenInfo): void {
        super.setScreenInfo(screenInfo);
        this.clearState();
        const {width, height} = screenInfo.videoSize;
        this.initCanvas(width, height);
    }

    public getPreferredVideoSetting(): VideoSettings {
        return H264bsdDecoder.preferredVideoSettings;
    }

    public pushFrame(frame: Uint8Array): void {
        if (H264bsdDecoder.isIFrame(frame)) {
            console.log(this.TAG, 'IFrame');
            if (this.videoSettings) {
                const {frameRate} = this.videoSettings;
                if (this.framesList.length > frameRate / 2) {
                    console.log('Dropping frames', this.framesList.length);
                    this.framesList = [];
                }
            }
        }
        this.framesList.push(frame);
    }

    private clearState(): void {
        this.framesList = [];
    }
}
