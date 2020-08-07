import VideoSettings from '../VideoSettings';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { H264bsdCanvas } from '../h264bsd_canvas.js';
import H264bsdWorker from '../h264bsd/H264bsdWorker';
import CanvasCommon from './CanvasCommon';

export default class H264bsdDecoder extends CanvasCommon {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 500000,
        frameRate: 24,
        iFrameInterval: 5,
        maxSize: 480,
        sendFrameMeta: false,
    });
    protected canvas?: H264bsdCanvas;
    private worker?: H264bsdWorker;
    public readonly supportsScreenshot: boolean = true;

    constructor(udid: string) {
        super(udid, 'H264bsdDecoder');
    }

    private onWorkerMessage = (e: MessageEvent): void => {
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
                this.canvas.drawNextOutputPicture(
                    message.width,
                    message.height,
                    message.croppingParams,
                    new Uint8Array(message.data),
                );
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
    };

    private initWorker(): void {
        this.worker = H264bsdWorker.getInstance();
        this.worker.worker.addEventListener('message', this.onWorkerMessage);
    }

    protected initCanvas(width: number, height: number): void {
        super.initCanvas(width, height);
        this.canvas = new H264bsdCanvas(this.tag);
    }

    protected decode(data: Uint8Array): void {
        if (!this.worker || !this.worker.isDecoderReady()) {
            return;
        }
        this.worker.worker.postMessage(
            {
                type: 'queueInput',
                data: data.buffer,
            },
            [data.buffer],
        );
    }

    public play(): void {
        super.play();
        if (!this.worker) {
            this.initWorker();
        }
    }

    public stop(): void {
        super.stop();
        if (this.worker && this.worker.worker) {
            this.worker.worker.removeEventListener('message', this.onWorkerMessage);
            delete this.worker;
        }
    }

    public getPreferredVideoSetting(): VideoSettings {
        return H264bsdDecoder.preferredVideoSettings;
    }
}
