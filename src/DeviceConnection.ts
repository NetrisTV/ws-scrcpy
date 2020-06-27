import VideoSettings from './VideoSettings';
import ControlEvent from './controlEvent/ControlEvent';
import MotionEvent from './MotionEvent';
import Position from './Position';
import Size from './Size';
import Point from './Point';
import Decoder from './decoder/Decoder';
import Util from './Util';
import TouchControlEvent from './controlEvent/TouchControlEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';
import ScreenInfo from './ScreenInfo';
import DeviceMessage from './DeviceMessage';

const CURSOR_RADIUS = 10;
const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC = 'scrcpy';
const DEVICE_INFO_LENGTH = MAGIC.length + DEVICE_NAME_FIELD_LENGTH + ScreenInfo.BUFFER_LENGTH + VideoSettings.BUFFER_LENGTH;

export interface ErrorListener {
    OnError(this: ErrorListener, ev: Event | string): void;
}

export interface DeviceMessageListener {
    OnDeviceMessage(this: DeviceMessageListener, ev: DeviceMessage): void;
}

interface Touch {
    action: number;
    position: Position;
    buttons: number;
}

interface TouchOnClient {
    client: {
        width: number;
        height: number;
    };
    touch: Touch;
}

interface CommonTouchAndMouse {
    clientX: number;
    clientY: number;
    type: string;
    target: EventTarget | null;
    button: number;
}

export class DeviceConnection {
    private static BUTTONS_MAP: Record<number, number> = {
        0: 17, // ?? BUTTON_PRIMARY
        1: MotionEvent.BUTTON_TERTIARY,
        2: 26  // ?? BUTTON_SECONDARY
    };
    private static EVENT_ACTION_MAP: Record<string, number> = {
        touchstart: MotionEvent.ACTION_DOWN,
        touchend: MotionEvent.ACTION_UP,
        touchmove: MotionEvent.ACTION_MOVE,
        touchcancel: MotionEvent.ACTION_UP,
        mousedown: MotionEvent.ACTION_DOWN,
        mousemove: MotionEvent.ACTION_MOVE,
        mouseup: MotionEvent.ACTION_UP
    };
    private static multiTouchActive: boolean = false;
    private static multiTouchCenter?: Point;
    private static multiTouchShift: boolean = false;
    private static dirtyPlace: Point[] = [];
    private static hasListeners: boolean = false;
    private static instances: Record<string, DeviceConnection> = {};
    public readonly ws: WebSocket;
    private events: ControlEvent[] = [];
    private decoders: Set<Decoder> = new Set<Decoder>();
    private errorListener?: ErrorListener;
    private deviceMessageListener?: DeviceMessageListener;
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

    private static setListeners(): void {
        if (!this.hasListeners) {
            let down = 0;
            const supportsPassive = Util.supportsPassive();
            const onMouseEvent = (e: MouseEvent | TouchEvent) => {
                Object.values(this.instances).forEach((connection: DeviceConnection) => {
                    if (connection.haveConnection()) {
                        connection.decoders.forEach(decoder => {
                            const tag = decoder.getTouchableElement();
                            if (e.target === tag) {
                                const screenInfo: ScreenInfo = decoder.getScreenInfo() as ScreenInfo;
                                if (!screenInfo) {
                                    return;
                                }
                                let events: TouchControlEvent[] | null = null;
                                let condition = true;
                                if (e instanceof MouseEvent) {
                                    condition = down > 0;
                                    events = DeviceConnection.buildTouchEvent(e, screenInfo);
                                } else if (e instanceof TouchEvent) {
                                    events = DeviceConnection.formatTouchEvent(e, screenInfo, tag);
                                }
                                if (events && events.length && condition) {
                                    events.forEach(event => {
                                        console.log(`sendEvent(${e.type}): ${event.toString()}`);
                                        connection.sendEvent(event);
                                    });
                                }
                                if (e.cancelable) {
                                    e.preventDefault();
                                }
                                e.stopPropagation();
                            }
                        });
                    }
                });
            };

            const options = supportsPassive ? { passive: false } : false;
            document.body.addEventListener('touchstart', (e: TouchEvent): void => {
                onMouseEvent(e);
            }, options);
            document.body.addEventListener('touchend', (e: TouchEvent): void => {
                onMouseEvent(e);
            }, options);
            document.body.addEventListener('touchmove', (e: TouchEvent): void => {
                onMouseEvent(e);
            }, options);
            document.body.addEventListener('touchcancel', (e: TouchEvent): void => {
                onMouseEvent(e);
            }, options);
            document.body.onmousedown = function(e: MouseEvent): void {
                down++;
                onMouseEvent(e);
            };
            document.body.onmouseup = function(e: MouseEvent): void {
                onMouseEvent(e);
                down--;
            };
            document.body.onmousemove = function(e: MouseEvent): void {
                onMouseEvent(e);
            };
            this.hasListeners = true;
        }
    }

    private static formatTouchEvent(e: TouchEvent, screenInfo: ScreenInfo, tag: HTMLElement): TouchControlEvent[] | null {
        const events: TouchControlEvent[] = [];
        const touches = (e.touches && e.touches.length) ? e.touches : e.changedTouches;
        if (touches && touches.length) {
            // FIXME: Disable multi-touch for now
            for (let i = 0, l = 1/*touches.length*/; i < l; i++) {
                const pointerId = i;
                const touch = touches[i];
                if (touch.target !== tag) {
                    continue;
                }
                const item: CommonTouchAndMouse = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    type: e.type,
                    button: 0,
                    target: e.target
                }
                const event = this.calculateCoordinates(item, screenInfo);
                if (event) {
                    const { action, buttons, position } = event.touch;
                    const pressure = touch.force * 255;
                    events.push(new TouchControlEvent(action, pointerId, position, pressure, buttons));
                } else {
                    console.error(`Failed to format touch`, touch);
                }
            }
        } else {
            console.error('No "touches"', e);
        }
        if (events.length) {
            return events;
        }
        return null;
    }
    private static buildTouchEvent(e: MouseEvent, screenInfo: ScreenInfo): TouchControlEvent[] | null {
        const touches = this.getTouch(e, screenInfo);
        if (!touches) {
            return null;
        }
        const target = e.target as HTMLCanvasElement;
        if (this.multiTouchActive) {
            const ctx = target.getContext('2d');
            if (ctx) {
                this.clearCanvas(target);
                touches.forEach(touch => {
                    const { point } = touch.position;
                    this.drawCircle(ctx, point);
                    if (this.multiTouchCenter) {
                        this.drawLine(ctx, point, this.multiTouchCenter);
                    }
                });
                if (this.multiTouchCenter) {
                    this.drawCircle(ctx, this.multiTouchCenter, 5);
                }
            }
        }
        return touches.map((touch: Touch, pointerId: number) => {
            const { action, buttons, position } = touch;
            return new TouchControlEvent(action, pointerId, position, 255, buttons);
        });
    }

    private static calculateCoordinates(e: CommonTouchAndMouse, screenInfo: ScreenInfo): TouchOnClient | null {
        const action = this.EVENT_ACTION_MAP[e.type];
        if (typeof action === 'undefined' || !screenInfo) {
            return null;
        }
        const htmlTag = document.getElementsByTagName('html')[0] as HTMLElement;
        const {width, height} = screenInfo.videoSize;
        const target: HTMLElement = e.target as HTMLElement;
        const {scrollTop, scrollLeft} = htmlTag;
        let {clientWidth, clientHeight} = target;
        let touchX = (e.clientX - target.offsetLeft) + scrollLeft;
        let touchY = (e.clientY - target.offsetTop) + scrollTop;
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
        const size = new Size(width, height);
        const point = new Point(x, y);
        const position = new Position(point, size);
        const buttons = this.BUTTONS_MAP[e.button];
        return {
            client: {
                width: clientWidth,
                height: clientHeight
            },
            touch: {
                action,
                position,
                buttons
            }
        };
    }

    private static getTouch(e: MouseEvent, screenInfo: ScreenInfo): Touch[] | null {
        const touchOnClient = this.calculateCoordinates(e, screenInfo);
        if (!touchOnClient) {
            return null;
        }
        const { client, touch } = touchOnClient;
        const result: Touch[] = [touch];
        if (!e.ctrlKey) {
            this.multiTouchActive = false;
            this.multiTouchCenter = undefined;
            this.multiTouchShift = false;
            this.clearCanvas(e.target as HTMLCanvasElement);
            return result;
        }
        const { position, action, buttons } = touch;
        const { point, screenSize } = position;
        const { width, height } = screenSize;
        const { x, y } = point;
        if (!this.multiTouchActive) {
            if (e.shiftKey) {
                this.multiTouchCenter = point;
                this.multiTouchShift = true;
            } else {
                this.multiTouchCenter = new Point(client.width / 2, client.height / 2);
            }
        }
        this.multiTouchActive = true;
        let opposite: Point | undefined;
        if (this.multiTouchShift && this.multiTouchCenter) {
            const oppoX = 2 * this.multiTouchCenter.x - x;
            const oppoY = 2 * this.multiTouchCenter.y - y;
            if (oppoX <= width && oppoX >= 0 && oppoY <= height && oppoY >= 0) {
                opposite = new Point(oppoX, oppoY);
            }
        } else {
            opposite = new Point(client.width - x, client.height - y);
        }
        if (opposite) {
            result.push({
                action,
                buttons,
                position: new Position(opposite, screenSize)
            });
        }
        return result;
    }

    private static drawCircle(ctx: CanvasRenderingContext2D, point: Point, radius: number = CURSOR_RADIUS): void {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, true);
        ctx.stroke();
        const l = ctx.lineWidth;
        const topLeft = new Point(point.x - radius - l, point.y - radius - l);
        const bottomRight = new Point(point.x + radius + l, point.y + radius + l);
        this.updateDirty(topLeft, bottomRight);
    }

    private static drawLine(ctx: CanvasRenderingContext2D, point1: Point, point2: Point): void {
        ctx.beginPath();
        ctx.moveTo(point1.x, point1.y);
        ctx.lineTo(point2.x, point2.y);
        ctx.stroke();
    }

    private static updateDirty(topLeft: Point, bottomRight: Point): void {
        if (!this.dirtyPlace.length) {
            this.dirtyPlace.push(topLeft, bottomRight);
            return;
        }
        const currentTopLeft = this.dirtyPlace[0];
        const currentBottomRight = this.dirtyPlace[1];
        const newTopLeft = new Point(Math.min(currentTopLeft.x, topLeft.x), Math.min(currentTopLeft.y, topLeft.y));
        const newBottomRight = new Point(Math.max(currentBottomRight.x, bottomRight.x), Math.max(currentBottomRight.y, bottomRight.y));
        this.dirtyPlace.length = 0;
        this.dirtyPlace.push(newTopLeft, newBottomRight);
    }

    private static clearCanvas(target: HTMLCanvasElement): void {
        const {clientWidth, clientHeight} = target;
        const ctx = target.getContext('2d');
        if (ctx && this.dirtyPlace.length) {
            const topLeft = this.dirtyPlace[0];
            const bottomRight = this.dirtyPlace[1];
            const x = Math.max(topLeft.x, 0);
            const y = Math.max(topLeft.y, 0);
            const w = Math.min(clientWidth, bottomRight.x - x);
            const h = Math.min(clientHeight, bottomRight.y - y);
            ctx.clearRect(x, y, w, h);
        }
    }

    public addDecoder(decoder: Decoder): void {
        let min: VideoSettings = decoder.getPreferredVideoSetting();
        const { maxSize } = min;
        let playing = false;
        this.decoders.forEach(d => {
            const state = d.getState();
            if (state === Decoder.STATE.PLAYING || state === Decoder.STATE.PAUSED) {
                playing = true;
            }
            const info = d.getScreenInfo() as ScreenInfo;
            const videoSize = info.videoSize;
            const {crop, bitrate, frameRate, iFrameInterval, sendFrameMeta, lockedVideoOrientation} =
                d.getVideoSettings() as VideoSettings;
            if (videoSize.width < maxSize && videoSize.height < maxSize) {
                min = new VideoSettings({
                    maxSize: Math.max(videoSize.width, videoSize.height),
                    crop,
                    bitrate,
                    frameRate,
                    iFrameInterval,
                    sendFrameMeta,
                    lockedVideoOrientation
                });
            }
        });
        if (playing) {
            // Will trigger encoding restart
            this.sendEvent(CommandControlEvent.createSetVideoSettingsCommand(min));
            // Decoder will wait for new screenInfo and then start to play
            decoder.pause();
        }
        this.decoders.add(decoder);
        DeviceConnection.setListeners();
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
        this.events.length = 0;
    }

    public sendEvent(event: ControlEvent): void {
        if (this.haveConnection()) {
            this.ws.send(event.toBuffer());
        } else {
            this.events.push(event);
        }
    }

    public setErrorListener(listener: ErrorListener): void {
        this.errorListener = listener;
    }

    public setDeviceMessageListener(listener: DeviceMessageListener): void {
        this.deviceMessageListener = listener;
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
        ws.onopen = () => {
            let e = this.events.shift();
            while (e) {
                this.sendEvent(e);
                e = this.events.shift();
            }
        };
        ws.onmessage = (e: MessageEvent) => {
            if (e.data instanceof ArrayBuffer) {
                const data = new Uint8Array(e.data);
                const magicBytes = new Uint8Array(e.data, 0, MAGIC.length);
                const text = Util.utf8ByteArrayToString(magicBytes);
                if (text === MAGIC) {
                    if (data.length === DEVICE_INFO_LENGTH) {
                        let nameBytes = new Uint8Array(e.data, MAGIC.length, DEVICE_NAME_FIELD_LENGTH);
                        nameBytes = Util.filterTrailingZeroes(nameBytes);
                        this.name = Util.utf8ByteArrayToString(nameBytes);
                        let processedLength = MAGIC.length + DEVICE_NAME_FIELD_LENGTH;
                        let temp = new Buffer(new Uint8Array(e.data, processedLength, ScreenInfo.BUFFER_LENGTH));
                        processedLength += ScreenInfo.BUFFER_LENGTH;
                        const screenInfo: ScreenInfo = ScreenInfo.fromBuffer(temp);
                        temp = new Buffer(new Uint8Array(e.data, processedLength, VideoSettings.BUFFER_LENGTH));
                        const videoSettings: VideoSettings = VideoSettings.fromBuffer(temp);
                        let min: VideoSettings = VideoSettings.copy(videoSettings) as VideoSettings;
                        let playing = false;
                        this.decoders.forEach(decoder => {
                            const STATE = Decoder.STATE;
                            if (decoder.getState() === STATE.PAUSED) {
                                decoder.play();
                            }
                            if (decoder.getState() === STATE.PLAYING) {
                                playing = true;
                            }
                            const oldInfo = decoder.getScreenInfo();
                            if (!screenInfo.equals(oldInfo)) {
                                decoder.setScreenInfo(screenInfo);
                            }
                            const oldSettings = decoder.getVideoSettings();
                            if (!videoSettings.equals(oldSettings)) {
                                decoder.setVideoSettings(videoSettings);
                            }
                            if (!oldInfo) {
                                const preferred = decoder.getPreferredVideoSetting();
                                const maxSize: number = preferred.maxSize;
                                const videoSize: Size = screenInfo.videoSize;
                                if (maxSize < videoSize.width || maxSize < videoSize.height) {
                                    min = preferred;
                                }
                            }
                        });
                        if (!min.equals(videoSettings) || !playing) {
                            this.sendEvent(CommandControlEvent.createSetVideoSettingsCommand(min));
                        }
                    } else {
                        const message = DeviceMessage.fromBuffer(e.data);
                        if (this.deviceMessageListener) {
                            this.deviceMessageListener.OnDeviceMessage(message);
                        }
                    }
                } else {
                    this.decoders.forEach(decoder => {
                        const STATE = Decoder.STATE;
                        if (decoder.getState() === STATE.PAUSED) {
                            decoder.play();
                        }
                        if (decoder.getState() === STATE.PLAYING) {
                            decoder.pushFrame(new Uint8Array(e.data));
                        }
                    });
                }
            } else {
                console.error(`Unexpexted message: ${e.data}`);
            }
        };
    }
}
