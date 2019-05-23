import { StreamInfo } from './StreamInfo';
import ControlEvent from './controlEvent/ControlEvent';
import MotionEvent from './MotionEvent';
import Position from './Position';
import Size from './Size';
import Point from './Point';
import Decoder from './decoder/Decoder';
import Util from './Util';
import MotionControlEvent from './controlEvent/MotionControlEvent';

const MESSAGE_TYPE_TEXT = 'text';
const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC = 'scrcpy';
const DEVICE_INFO_LENGTH = DEVICE_NAME_FIELD_LENGTH + 9 + MAGIC.length;

export interface IErrorListener {
    OnError(this: IErrorListener, ev: Event | string): void;
}

export class DeviceConnection {
    private static BUTTONS_MAP: Record<number, number> = {
        0: 17, // ?? BUTTON_PRIMARY
        1: MotionEvent.BUTTON_TERTIARY,
        2: 26  // ?? BUTTON_SECONDARY
    };
    private static EVENT_ACTION_MAP: Record<string, number> = {
        mousedown: MotionEvent.ACTION_DOWN,
        mousemove: MotionEvent.ACTION_MOVE,
        mouseup: MotionEvent.ACTION_UP
    };
    private static instances: Record<string, DeviceConnection> = {};
    public readonly ws: WebSocket;
    private decoders: Set<Decoder> = new Set<Decoder>();
    private errorListener?: IErrorListener;
    private name: string = '';

    constructor(readonly url: string) {
        this.url = url;
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
        this.init();
    }

    public static getInstance(url: string): DeviceConnection {
        if (!this.instances[url]) {
            this.instances[url] = new DeviceConnection(url);
        }
        return this.instances[url];
    }

    private static buildMotionEvent(e: MouseEvent, streamInfo: StreamInfo): MotionControlEvent | null {
        const action = this.EVENT_ACTION_MAP[e.type];
        if (typeof action === 'undefined' || !streamInfo) {
            return null;
        }
        const width = streamInfo.width;
        const height = streamInfo.height;
        const target: HTMLElement = e.target as HTMLElement;
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

    public addDecoder(decoder: Decoder): void {
        this.decoders.add(decoder);
    }

    public removeDecoder(decoder: Decoder): void {
        this.decoders.delete(decoder);
        if (!this.decoders.size) {
            this.stop();
        }
    }

    public stop(): void {
        if (this.haveConnection()) {
            this.ws.close();
        }
        this.decoders.forEach(decoder => decoder.pause());
        delete DeviceConnection.instances[this.url];
    }

    public sendEvent(event: ControlEvent): void {
        if (this.haveConnection()) {
            this.ws.send(event.toBuffer());
        }
    }

    public setErrorListener(listener: IErrorListener): void {
        this.errorListener = listener;
    }

    public getDeviceName(): string {
        return this.name;
    }

    private haveConnection(): boolean {
        return this.ws && this.ws.readyState === this.ws.OPEN;
    }

    private init(): void {
        const ws = this.ws;

        ws.onerror = (e: Event | string) => {
            if (this.errorListener) {
                this.errorListener.OnError.call(this.errorListener, e);
            }
            if (ws.readyState === ws.CLOSED) {
                console.error('WS closed');
            }
        };

        ws.onmessage = (e: MessageEvent) => {
            if (e.data instanceof ArrayBuffer) {
                const data = new Uint8Array(e.data);
                if (data.length === DEVICE_INFO_LENGTH) {
                    const magicBytes = new Uint8Array(e.data, DEVICE_NAME_FIELD_LENGTH + 9, MAGIC.length);
                    const text = Util.utf8ByteArrayToString(magicBytes);
                    if (text === MAGIC) {
                        let nameBytes = new Uint8Array(e.data, 0, DEVICE_NAME_FIELD_LENGTH);
                        nameBytes = Util.filterTrailingZeroes(nameBytes);
                        this.name = Util.utf8ByteArrayToString(nameBytes);
                        const buffer = new Buffer(new Uint8Array(e.data, DEVICE_NAME_FIELD_LENGTH, 9));
                        const newInfo = StreamInfo.fromBuffer(buffer);
                        this.decoders.forEach(decoder => {
                            if (!newInfo.equals(decoder.getStreamInfo())) {
                                decoder.setStreamInfo(newInfo);
                                decoder.play();
                            }
                        });
                    }
                } else {
                    this.decoders.forEach(decoder => decoder.pushFrame(new Uint8Array(e.data)));
                }
            } else {
                let data;
                try {
                    data = JSON.parse(e.data);
                } catch (e) {
                    console.log(e.data);
                    return;
                }
                if (data.type === MESSAGE_TYPE_TEXT) {
                    console.log(data.message);
                } else {
                    console.log(e.data);
                }
            }
        };

        let down = 0;

        const onMouseEvent = (e: MouseEvent) => {
            if (this.haveConnection()) {
                this.decoders.forEach(decoder => {
                    const tag = decoder.getElement();
                    if (e.target === tag) {
                        const streamInfo = decoder.getStreamInfo();
                        if (!streamInfo) {
                            return;
                        }
                        const event = DeviceConnection.buildMotionEvent(e, streamInfo);
                        if (event) {
                            this.ws.send(event.toBuffer());
                        }
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }
        };

        document.body.onmousedown = function(e: MouseEvent): void {
            down++;
            onMouseEvent(e);
        };
        document.body.onmouseup = function(e: MouseEvent): void {
            down--;
            onMouseEvent(e);
        };
        document.body.onmousemove = function(e: MouseEvent): void {
            if (down > 0) {
                onMouseEvent(e);
            }
        };
    }
}
