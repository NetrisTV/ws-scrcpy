import VideoSettings from './VideoSettings';
import ControlEvent from './controlEvent/ControlEvent';
import MotionEvent from './MotionEvent';
import Position from './Position';
import Size from './Size';
import Point from './Point';
import Decoder from './decoder/Decoder';
import Util from './Util';
import MotionControlEvent from './controlEvent/MotionControlEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';
import ScreenInfo from './ScreenInfo';
import DeviceMessage from './DeviceMessage';

const MESSAGE_TYPE_TEXT = 'text';
const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC = 'scrcpy';
const DEVICE_INFO_LENGTH = MAGIC.length + DEVICE_NAME_FIELD_LENGTH +
    ScreenInfo.BUFFER_LENGTH + VideoSettings.BUFFER_LENGTH;

export interface ErrorListener {
    OnError(this: ErrorListener, ev: Event | string): void;
}

export interface DeviceMessageListener {
    OnDeviceMessage(this: DeviceMessageListener, ev: DeviceMessage): void;
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
    private static hasListeners: boolean = false;
    private static instances: Record<string, DeviceConnection> = {};
    public readonly ws: WebSocket;
    private events: ControlEvent[] = [];
    private decoders: Set<Decoder> = new Set<Decoder>();
    private errorListener?: ErrorListener;
    private deviceMessageListener?: DeviceMessageListener;
    private name: string = '';
    // private videoSettings?: VideoSettings;
    // private screenInfo?: ScreenInfo;

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

            const onMouseEvent = (e: MouseEvent) => {
                Object.values(this.instances).forEach((connection: DeviceConnection) => {
                    if (connection.haveConnection()) {
                        connection.decoders.forEach(decoder => {
                            const tag = decoder.getElement();
                            if (e.target === tag) {
                                const screenInfo: ScreenInfo = decoder.getScreenInfo() as ScreenInfo;
                                if (!screenInfo) {
                                    return;
                                }
                                const event = DeviceConnection.buildMotionEvent(e, screenInfo);
                                if (event) {
                                    connection.sendEvent(event);
                                }
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        });
                    }
                });
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
            this.hasListeners = true;
        }
    }

    private static buildMotionEvent(e: MouseEvent, screenInfo: ScreenInfo): MotionControlEvent | null {
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
        const position = new Position(new Point(x, y), new Size(width, height));
        return new MotionControlEvent(action, this.BUTTONS_MAP[e.button], position);
    }

    public addDecoder(decoder: Decoder): void {
        let min: VideoSettings = decoder.getPreferredVideoSetting();
        const bounds: Size = min.bounds as Size;
        let playing = false;
        this.decoders.forEach(d => {
            const state = d.getState();
            if (state === Decoder.STATE.PLAYING || state === Decoder.STATE.PAUSED) {
                playing = true;
            }
            const info = d.getScreenInfo() as ScreenInfo;
            const videoSize = info.videoSize;
            const {crop, bitrate, frameRate, iFrameInterval, sendFrameMeta} =
                d.getVideoSettings() as VideoSettings;
            if (videoSize.width < bounds.width && videoSize.height < bounds.height) {
                min = new VideoSettings({
                    bounds: videoSize,
                    crop,
                    bitrate,
                    frameRate,
                    iFrameInterval,
                    sendFrameMeta
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
                                const bounds: Size = preferred.bounds as Size;
                                const videoSize: Size = screenInfo.videoSize;
                                if (bounds.width < videoSize.width || bounds.height < videoSize.height) {
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
                let data;
                try {
                    data = JSON.parse(e.data);
                } catch (error) {
                    console.error(error.message);
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
    }
}
