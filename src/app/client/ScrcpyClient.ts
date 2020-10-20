import MseDecoder from '../decoder/MseDecoder';
import BroadwayDecoder from '../decoder/BroadwayDecoder';
import { BaseClient } from './BaseClient';
import Decoder from '../decoder/Decoder';
import Tinyh264Decoder from '../decoder/Tinyh264Decoder';
import { Decoders } from '../../common/Decoders';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { DroidMoreBox } from '../toolbox/DroidMoreBox';
import { DroidToolBox } from '../toolbox/DroidToolBox';
import VideoSettings from '../VideoSettings';
import Size from '../Size';
import { ControlMessage } from '../controlMessage/ControlMessage';
import { StreamReceiver } from './StreamReceiver';
import { CommandControlMessage } from '../controlMessage/CommandControlMessage';
import TouchHandler from '../TouchHandler';
import Util from '../Util';
import ScreenInfo from '../ScreenInfo';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import FilePushHandler from '../FilePushHandler';
import DragAndPushLogger from '../DragAndPushLogger';
import { KeyEventListener, KeyInputHandler } from '../KeyInputHandler';
import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';

export class ScrcpyClient extends BaseClient<never> implements KeyEventListener {
    public static ACTION = 'stream';
    private hasTouchListeners = false;

    private controlButtons?: HTMLElement;
    private deviceName = '';
    private clientId = -1;
    private clientsCount = -1;
    private requestedVideoSettings?: VideoSettings;
    private readonly streamReceiver: StreamReceiver;

    constructor(params: ScrcpyStreamParams) {
        super();

        this.streamReceiver = new StreamReceiver(params.ip, params.port, params.query);
        this.startStream(params.udid, params.decoder);
        this.setBodyClass('stream');
        this.setTitle(`${params.udid} stream`);
    }

    public startStream(udid: string, decoderName: Decoders): void {
        if (!udid) {
            return;
        }
        let decoderClass: new (udid: string) => Decoder;
        switch (decoderName) {
            case 'mse':
                decoderClass = MseDecoder;
                break;
            case 'broadway':
                decoderClass = BroadwayDecoder;
                break;
            case 'tinyh264':
                decoderClass = Tinyh264Decoder;
                break;
            default:
                return;
        }
        const decoder = new decoderClass(udid);
        this.setTouchListeners(decoder);

        const deviceView = document.createElement('div');
        deviceView.className = 'device-view';
        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(ev);
            }
            let parent;
            parent = deviceView.parentElement;
            if (parent) {
                parent.removeChild(deviceView);
            }
            parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            this.streamReceiver.stop();
            decoder.stop();
        };

        const droidMoreBox = new DroidMoreBox(udid, decoder, this);
        const moreBox = droidMoreBox.getHolderElement();
        droidMoreBox.setOnStop(stop);
        const droidToolBox = DroidToolBox.createToolBox(udid, decoder, this, moreBox);
        this.controlButtons = droidToolBox.getHolderElement();
        deviceView.appendChild(this.controlButtons);
        const video = document.createElement('div');
        video.className = 'video';
        deviceView.appendChild(video);
        deviceView.appendChild(moreBox);
        decoder.setParent(video);
        decoder.pause();

        document.body.appendChild(deviceView);
        const current = decoder.getVideoSettings();
        if (decoder.getPreferredVideoSetting().equals(current)) {
            const bounds = this.getMaxSize();
            const { bitrate, maxFps, iFrameInterval, lockedVideoOrientation, sendFrameMeta } = current;
            const newVideoSettings = new VideoSettings({
                bounds,
                bitrate,
                maxFps,
                iFrameInterval,
                lockedVideoOrientation,
                sendFrameMeta,
            });
            decoder.setVideoSettings(newVideoSettings, false);
        }
        const element = decoder.getTouchableElement();
        const handler = new FilePushHandler(element, this.streamReceiver);
        const logger = new DragAndPushLogger(element);
        handler.addEventListener(logger);
        // this.filePushHandlers.set(decoder, handler);

        const streamReceiver = this.streamReceiver;
        streamReceiver.on('deviceMessage', (message) => {
            droidMoreBox.OnDeviceMessage(message);
        });
        streamReceiver.on('video', (data) => {
            const STATE = Decoder.STATE;
            if (decoder.getState() === STATE.PAUSED) {
                decoder.play();
            }
            if (decoder.getState() === STATE.PLAYING) {
                decoder.pushFrame(new Uint8Array(data));
            }
        });
        streamReceiver.on('clientsStats', (stats) => {
            this.deviceName = stats.deviceName;
            this.clientId = stats.clientId;
            this.clientsCount = stats.clientsCount;
        });
        streamReceiver.on('videoParameters', ({ screenInfo, videoSettings }) => {
            let min = VideoSettings.copy(videoSettings);
            let playing = false;
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
                decoder.setVideoSettings(videoSettings, videoSettings.equals(this.requestedVideoSettings));
            }
            if (!oldInfo) {
                const bounds = oldSettings.bounds;
                const videoSize: Size = screenInfo.videoSize;
                const onlyOneClient = this.clientsCount === 0;
                const smallerThenCurrent =
                    bounds && (bounds.width < videoSize.width || bounds.height < videoSize.height);
                if (onlyOneClient || smallerThenCurrent) {
                    min = oldSettings;
                }
            }
            if (!min.equals(videoSettings) || !playing) {
                this.sendNewVideoSetting(min);
            }
        });
        console.log(decoder.getName(), udid);
    }

    public sendEvent(e: ControlMessage): void {
        this.streamReceiver.sendEvent(e);
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public setHandleKeyboardEvents(enabled: boolean): void {
        if (enabled) {
            KeyInputHandler.addEventListener(this);
        } else {
            KeyInputHandler.removeEventListener(this);
        }
    }

    public onKeyEvent(event: KeyCodeControlMessage): void {
        this.sendEvent(event);
    }

    public sendNewVideoSetting(videoSettings: VideoSettings): void {
        this.requestedVideoSettings = videoSettings;
        this.sendEvent(CommandControlMessage.createSetVideoSettingsCommand(videoSettings));
    }

    public getClientId(): number {
        return this.clientId;
    }

    public getClientsCount(): number {
        return this.clientsCount;
    }

    private getMaxSize(): Size | undefined {
        if (!this.controlButtons) {
            return;
        }
        const body = document.body;
        const width = (body.clientWidth - this.controlButtons.clientWidth) & ~15;
        const height = body.clientHeight & ~15;
        return new Size(width, height);
    }

    private setTouchListeners(decoder: Decoder): void {
        if (!this.hasTouchListeners) {
            TouchHandler.init();
            let down = 0;
            const supportsPassive = Util.supportsPassive();
            const onMouseEvent = (e: MouseEvent | TouchEvent) => {
                const tag = decoder.getTouchableElement();
                if (e.target === tag) {
                    const screenInfo: ScreenInfo = decoder.getScreenInfo() as ScreenInfo;
                    if (!screenInfo) {
                        return;
                    }
                    let events: TouchControlMessage[] | null = null;
                    let condition = true;
                    if (e instanceof MouseEvent) {
                        condition = down > 0;
                        events = TouchHandler.buildTouchEvent(e, screenInfo);
                    } else if (e instanceof TouchEvent) {
                        events = TouchHandler.formatTouchEvent(e, screenInfo, tag);
                    }
                    if (events && events.length && condition) {
                        events.forEach((event) => {
                            this.sendEvent(event);
                        });
                    }
                    if (e.cancelable) {
                        e.preventDefault();
                    }
                    e.stopPropagation();
                }
            };

            const options = supportsPassive ? { passive: false } : false;
            document.body.addEventListener(
                'touchstart',
                (e: TouchEvent): void => {
                    onMouseEvent(e);
                },
                options,
            );
            document.body.addEventListener(
                'touchend',
                (e: TouchEvent): void => {
                    onMouseEvent(e);
                },
                options,
            );
            document.body.addEventListener(
                'touchmove',
                (e: TouchEvent): void => {
                    onMouseEvent(e);
                },
                options,
            );
            document.body.addEventListener(
                'touchcancel',
                (e: TouchEvent): void => {
                    onMouseEvent(e);
                },
                options,
            );
            document.body.addEventListener('mousedown', (e: MouseEvent): void => {
                down++;
                onMouseEvent(e);
            });
            document.body.addEventListener('mouseup', (e: MouseEvent): void => {
                onMouseEvent(e);
                down--;
            });
            document.body.addEventListener('mousemove', (e: MouseEvent): void => {
                onMouseEvent(e);
            });
            this.hasTouchListeners = true;
        }
    }
}
