import {StreamInfo} from "./StreamInfo";
import {ControlEvent, MotionControlEvent} from "./ControlEvent";
import MotionEvent from "./MotionEvent";
import Position from "./Position";
import Size from "./Size";
import Point from "./Point";
import Decoder from "./decoder/Decoder";
import Util from "./Util";

const MESSAGE_TYPE_TEXT = "text";
const MESSAGE_TYPE_STREAM_INFO = "stream_info";
const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC = "scrcpy";
const DEVICE_INFO_LENGTH = DEVICE_NAME_FIELD_LENGTH + 9 + MAGIC.length;

export interface ErrorListener {
    OnError: (this: ErrorListener, ev: Event | string) => any;
}

export class DeviceConnection {
    private static BUTTONS_MAP: Record<number, number> = {
        0: 17, // ?? BUTTON_PRIMARY
        1: MotionEvent.BUTTON_TERTIARY,
        2: 26  // ?? BUTTON_SECONDARY
    };
    private static EVENT_ACTION_MAP: Record<string, number> = {
        'mousedown': MotionEvent.ACTION_DOWN,
        'mousemove': MotionEvent.ACTION_MOVE,
        'mouseup': MotionEvent.ACTION_UP,
    };
    readonly ws: WebSocket;
    private errorListener?: ErrorListener;
    private name: string = '';

    constructor(private decoder: Decoder, readonly url: string) {
        this.url = url;
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
        this.init();
    }

    private static buildMotionEvent(e: MouseEvent, streamInfo: StreamInfo): MotionControlEvent | null {
        const action = this.EVENT_ACTION_MAP[e.type];
        if (typeof action === 'undefined' || !streamInfo) {
            return null;
        }
        const width = streamInfo.width;
        const height = streamInfo.height;
        const target: HTMLElement = <HTMLElement>e.target;
        let {clientWidth, clientHeight} = target;
        let touchX = (e.clientX - target.offsetLeft);
        let touchY = (e.clientY - target.offsetTop);
        const eps = 1e5;
        const ratio = width / height;
        const shouldBe = Math.round(eps * ratio);
        const haveNow = Math.round(eps * clientWidth / clientHeight);
        if (shouldBe > haveNow) {
            const realHeight = Math.ceil(clientWidth / ratio);
            const top = (clientHeight - realHeight) / 2;
            if (touchY < top || touchY > top + realHeight) {
                return null;
            }
            touchY -= top;
            clientHeight = realHeight;
        } else if (shouldBe < haveNow) {
            const realWidth = Math.ceil(clientHeight * ratio);
            const left = (clientWidth - realWidth) / 2;
            if (touchX < left || touchX > left + realWidth) {
                return null;
            }
            touchX -= left;
            clientWidth = realWidth;
        }
        const x = touchX * width / clientWidth;
        const y = touchY * height / clientHeight;
        const position = new Position(new Point(x, y), new Size(width, height));
        return new MotionControlEvent(action, this.BUTTONS_MAP[e.button], position);
    }

    public stop(): void {
        if (this.haveConnection()) {
            this.ws.close()
        }
        if (this.decoder) {
            this.decoder.pause();
        }
    }

    public sendEvent(event: ControlEvent): void {
        if (this.haveConnection()) {
            this.ws.send(event.toBuffer());
        }
    }

    public setErrorListener(listener: ErrorListener): void {
        this.errorListener = listener;
    }

    public getDeviceName(): string {
        return this.name;
    }

    private haveConnection(): boolean {
        return this.ws && this.ws.readyState === this.ws.OPEN;
    }

    private init() {
        let tag: HTMLElement = this.decoder.getElement();
        const ws = this.ws;

        ws.onerror = (e: Event | string) => {
            if (this.errorListener) {
                this.errorListener.OnError.call(this.errorListener, e);
            }
            if (ws.readyState === ws.CLOSED) {
                console.error("WS closed");
            }
        };

        ws.onmessage = (e: MessageEvent) => {
            const streamInfo = this.decoder.getStreamInfo();
            if (e.data instanceof ArrayBuffer) {
                const data = new Uint8Array(e.data);
                if (data.length === DEVICE_INFO_LENGTH) {
                    const magicBytes = new Uint8Array(e.data, DEVICE_NAME_FIELD_LENGTH + 9, MAGIC.length);
                    const text = Util.utf8ByteArrayToString(magicBytes);
                    if (text === MAGIC) {
                        let nameBytes = new Uint8Array(e.data, 0, DEVICE_NAME_FIELD_LENGTH);
                        nameBytes = Util.filterTrailingZeroes(nameBytes);
                        this.name = Util.utf8ByteArrayToString(nameBytes);
                        const data = new Uint8Array(e.data, DEVICE_NAME_FIELD_LENGTH, 9);
                        const buffer = new Buffer(data);
                        const newInfo = StreamInfo.fromBuffer(buffer);
                        this.decoder.setStreamInfo(newInfo);
                        tag = this.decoder.getElement();
                        this.decoder.play();
                    }
                } else {
                    this.decoder.pushFrame(new Uint8Array(e.data));
                }
            } else {
                let data;
                try {
                    data = JSON.parse(e.data);
                } catch (e) {
                    console.log(e.data);
                    return;
                }
                switch (data.type) {
                    case MESSAGE_TYPE_STREAM_INFO:
                        const newInfo = new StreamInfo(data);
                        if (!streamInfo || !streamInfo.equals(newInfo)) {
                            this.decoder.setStreamInfo(newInfo);
                            tag = this.decoder.getElement();
                            this.decoder.play();
                        }
                        break;
                    case MESSAGE_TYPE_TEXT:
                        console.log(data.message);
                        break;
                    default:
                        console.log(e.data);
                }
            }
        };


        let down = 0;

        const onMouseEvent = (e: MouseEvent) => {
            if (e.target === tag && this.haveConnection()) {
                const streamInfo = this.decoder.getStreamInfo();
                if (!streamInfo) {
                    return;
                }
                const event = DeviceConnection.buildMotionEvent(e, streamInfo);
                if (event) {
                    this.ws.send(event.toBuffer());
                }
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            return true;
        };

        document.body.onmousedown = function (e) {
            down++;
            onMouseEvent(e);
        };
        document.body.onmouseup = function (e) {
            down--;
            onMouseEvent(e);
        };
        document.body.onmousemove = function (e) {
            if (down > 0) {
                onMouseEvent(e);
            }
        };
    }
}
