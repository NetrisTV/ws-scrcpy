import VideoSettings from './VideoSettings';
import ControlEvent from './controlEvent/ControlEvent';
import Size from './Size';
import Decoder from './decoder/Decoder';
import Util from './Util';
import TouchControlEvent from './controlEvent/TouchControlEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';
import ScreenInfo from './ScreenInfo';
import DeviceMessage from './DeviceMessage';
import TouchHandler from "./TouchHandler";
import {KeyEventListener, KeyInputHandler} from "./KeyInputHandler";
import KeyCodeControlEvent from "./controlEvent/KeyCodeControlEvent";

const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC = 'scrcpy';
const DEVICE_INFO_LENGTH = MAGIC.length + DEVICE_NAME_FIELD_LENGTH + ScreenInfo.BUFFER_LENGTH + VideoSettings.BUFFER_LENGTH;

export interface ErrorListener {
    OnError(this: ErrorListener, ev: Event | string): void;
}

export interface DeviceMessageListener {
    OnDeviceMessage(this: DeviceMessageListener, ev: DeviceMessage): void;
}

export class DeviceConnection implements KeyEventListener {
    private static hasListeners: boolean = false;
    private static instances: Record<string, DeviceConnection> = {};
    public readonly ws: WebSocket;
    private events: ControlEvent[] = [];
    private decoders: Set<Decoder> = new Set<Decoder>();
    private errorListener?: ErrorListener;
    private deviceMessageListener?: DeviceMessageListener;
    private name: string = '';

    constructor(readonly udid: string, readonly url: string) {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
        this.init();
    }

    public static getInstance(udid: string, url: string): DeviceConnection {
        const key = `${udid}::${url}`
        if (!this.instances[key]) {
            this.instances[key] = new DeviceConnection(udid, url);
        }
        return this.instances[key];
    }

    private static setListeners(): void {
        if (!this.hasListeners) {
            let down = 0;
            const supportsPassive = Util.supportsPassive();
            const onMouseEvent = (e: MouseEvent | TouchEvent) => {
                for (let key in this.instances) {
                    const connection: DeviceConnection = this.instances[key];
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
                                    events = TouchHandler.buildTouchEvent(e, screenInfo);
                                } else if (e instanceof TouchEvent) {
                                    events = TouchHandler.formatTouchEvent(e, screenInfo, tag);
                                }
                                if (events && events.length && condition) {
                                    events.forEach(event => {
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
                }
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

    public addDecoder(decoder: Decoder): void {
        let videoSettings: VideoSettings = decoder.getVideoSettings();
        const { maxSize } = videoSettings;
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
                videoSettings = new VideoSettings({
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
            this.sendEvent(CommandControlEvent.createSetVideoSettingsCommand(videoSettings));
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

    public setHandleKeyboardEvents(value: boolean): void {
        if (value) {
            KeyInputHandler.addEventListener(this);
        } else {
            KeyInputHandler.removeEventListener(this);
        }
    }

    public onKeyEvent(event: KeyCodeControlEvent): void {
        this.sendEvent(event);
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
                                const maxSize: number = oldSettings.maxSize;
                                const videoSize: Size = screenInfo.videoSize;
                                if (maxSize < videoSize.width || maxSize < videoSize.height) {
                                    min = oldSettings;
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
