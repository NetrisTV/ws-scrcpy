import Decoder, { VideoResizeListener } from './decoder/Decoder';
import { DeviceConnection, DeviceMessageListener } from './DeviceConnection';
import VideoSettings from './VideoSettings';
import ErrorHandler from './ErrorHandler';
import KeyCodeControlEvent from './controlEvent/KeyCodeControlEvent';
import KeyEvent from './android/KeyEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';
import ControlEvent from './controlEvent/ControlEvent';
import TextControlEvent from './controlEvent/TextControlEvent';
import DeviceMessage from './DeviceMessage';
import SvgImage from './ui/SvgImage';
import Size from './Size';

export interface DeviceControllerParams {
    url: string;
    udid: string;
    decoder: Decoder;
}

export class DeviceController implements DeviceMessageListener, VideoResizeListener {
    public readonly decoder: Decoder;
    public readonly deviceView: HTMLDivElement;
    public readonly input: HTMLInputElement;
    private readonly moreBox: HTMLDivElement;
    private readonly controlButtons: HTMLElement;
    private readonly deviceConnection: DeviceConnection;

    constructor(params: DeviceControllerParams) {
        const decoder = (this.decoder = params.decoder);
        const udid = params.udid;
        const decoderName = this.decoder.getName();
        const deviceView = (this.deviceView = document.createElement('div'));
        deviceView.className = 'device-view';
        const connection = (this.deviceConnection = DeviceConnection.getInstance(udid, params.url));
        const videoSettings = decoder.getVideoSettings();
        connection.addEventListener(this);
        const moreBox = (this.moreBox = document.createElement('div'));
        moreBox.className = 'more-box';
        const nameBox = document.createElement('p');
        nameBox.innerText = `${udid} (${decoderName})`;
        nameBox.className = 'text-with-shadow';
        moreBox.appendChild(nameBox);
        const textWrap = document.createElement('div');
        const input = (this.input = document.createElement('input'));
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send as keys';
        textWrap.appendChild(input);
        textWrap.appendChild(sendButton);

        moreBox.appendChild(textWrap);
        sendButton.onclick = () => {
            if (input.value) {
                connection.sendEvent(new TextControlEvent(input.value));
            }
        };

        this.controlButtons = document.createElement('div');
        this.controlButtons.className = 'control-buttons-list';
        const cmdWrap = document.createElement('div');
        const codes = CommandControlEvent.CommandCodes;
        for (const command in codes) {
            if (codes.hasOwnProperty(command)) {
                const action: number = codes[command];
                const btn = document.createElement('button');
                let bitrateInput: HTMLInputElement;
                let maxFpsInput: HTMLInputElement;
                let iFrameIntervalInput: HTMLInputElement;
                if (action === ControlEvent.TYPE_CHANGE_STREAM_PARAMETERS) {
                    const spoiler = document.createElement('div');
                    const spoilerLabel = document.createElement('label');
                    const spoilerCheck = document.createElement('input');

                    const innerDiv = document.createElement('div');
                    const id = `spoiler_video_${udid}_${decoderName}_${action}`;

                    spoiler.className = 'spoiler';
                    spoilerCheck.type = 'checkbox';
                    spoilerCheck.id = id;
                    spoilerLabel.htmlFor = id;
                    spoilerLabel.innerText = CommandControlEvent.CommandNames[action];
                    innerDiv.className = 'box';
                    spoiler.appendChild(spoilerCheck);
                    spoiler.appendChild(spoilerLabel);
                    spoiler.appendChild(innerDiv);

                    const bitrateWrap = document.createElement('div');
                    const bitrateLabel = document.createElement('label');
                    bitrateLabel.innerText = 'Bitrate:';
                    bitrateInput = document.createElement('input');
                    bitrateInput.placeholder = `bitrate (${videoSettings.bitrate})`;
                    bitrateInput.value = videoSettings.bitrate.toString();
                    bitrateWrap.appendChild(bitrateLabel);
                    bitrateWrap.appendChild(bitrateInput);

                    const maxFpsWrap = document.createElement('div');
                    const maxFpsLabel = document.createElement('label');
                    maxFpsLabel.innerText = 'Max fps:';
                    maxFpsInput = document.createElement('input');
                    maxFpsInput.placeholder = `max fps (${videoSettings.maxFps})`;
                    maxFpsInput.value = videoSettings.maxFps.toString();
                    maxFpsWrap.appendChild(maxFpsLabel);
                    maxFpsWrap.appendChild(maxFpsInput);

                    const iFrameIntervalWrap = document.createElement('div');
                    const iFrameIntervalLabel = document.createElement('label');
                    iFrameIntervalLabel.innerText = 'I-Frame Interval:';
                    iFrameIntervalInput = document.createElement('input');
                    iFrameIntervalInput.placeholder = `I-frame interval (${videoSettings.iFrameInterval})`;
                    iFrameIntervalInput.value = videoSettings.iFrameInterval.toString();
                    iFrameIntervalWrap.appendChild(iFrameIntervalLabel);
                    iFrameIntervalWrap.appendChild(iFrameIntervalInput);

                    innerDiv.appendChild(bitrateWrap);
                    innerDiv.appendChild(maxFpsWrap);
                    innerDiv.appendChild(iFrameIntervalWrap);
                    innerDiv.appendChild(btn);
                    cmdWrap.appendChild(spoiler);
                } else {
                    cmdWrap.appendChild(btn);
                }
                btn.innerText = CommandControlEvent.CommandNames[action];
                btn.onclick = () => {
                    let event: CommandControlEvent | undefined;
                    if (action === ControlEvent.TYPE_CHANGE_STREAM_PARAMETERS) {
                        const bitrate = parseInt(bitrateInput.value, 10);
                        const maxFps = parseInt(maxFpsInput.value, 10);
                        const iFrameInterval = parseInt(iFrameIntervalInput.value, 10);
                        if (isNaN(bitrate) || isNaN(maxFps)) {
                            return;
                        }
                        const bounds = this.getMaxSize();
                        const videoSettings = new VideoSettings({
                            bounds,
                            bitrate,
                            maxFps,
                            iFrameInterval,
                            lockedVideoOrientation: -1,
                            sendFrameMeta: false,
                        });
                        connection.sendNewVideoSetting(videoSettings);
                    } else if (action === CommandControlEvent.TYPE_SET_CLIPBOARD) {
                        const text = input.value;
                        if (text) {
                            event = CommandControlEvent.createSetClipboardCommand(text);
                        }
                    } else {
                        event = new CommandControlEvent(action);
                    }
                    if (event) {
                        connection.sendEvent(event);
                    }
                };
            }
        }
        const list = [
            {
                title: 'Power',
                code: KeyEvent.KEYCODE_POWER,
                icon: SvgImage.Icon.POWER,
            },
            {
                title: 'Volume up',
                code: KeyEvent.KEYCODE_VOLUME_UP,
                icon: SvgImage.Icon.VOLUME_UP,
            },
            {
                title: 'Volume down',
                code: KeyEvent.KEYCODE_VOLUME_DOWN,
                icon: SvgImage.Icon.VOLUME_DOWN,
            },
            {
                title: 'Back',
                code: KeyEvent.KEYCODE_BACK,
                icon: SvgImage.Icon.BACK,
            },
            {
                title: 'Home',
                code: KeyEvent.KEYCODE_HOME,
                icon: SvgImage.Icon.HOME,
            },
            {
                title: 'Overview',
                code: KeyEvent.KEYCODE_APP_SWITCH,
                icon: SvgImage.Icon.OVERVIEW,
            },
        ];
        list.forEach((item) => {
            const { code, icon, title } = item;
            const btn = document.createElement('button');
            btn.classList.add('control-button');
            btn.title = title;
            btn.appendChild(SvgImage.create(icon));
            btn.onmousedown = () => {
                const event = new KeyCodeControlEvent(KeyEvent.ACTION_DOWN, code, 0, 0);
                connection.sendEvent(event);
            };
            btn.onmouseup = () => {
                const event = new KeyCodeControlEvent(KeyEvent.ACTION_UP, code, 0, 0);
                connection.sendEvent(event);
            };
            this.controlButtons.appendChild(btn);
        });
        if (decoder.supportsScreenshot) {
            const screenshotButton = document.createElement('button');
            screenshotButton.classList.add('control-button');
            screenshotButton.title = 'Take screenshot';
            screenshotButton.appendChild(SvgImage.create(SvgImage.Icon.CAMERA));
            screenshotButton.onclick = () => {
                decoder.createScreenshot(connection.getDeviceName());
            };
            this.controlButtons.appendChild(screenshotButton);
        }
        const captureKeyboardInput = document.createElement('input');
        captureKeyboardInput.type = 'checkbox';
        const captureKeyboardLabel = document.createElement('label');
        captureKeyboardLabel.title = 'Capture keyboard';
        captureKeyboardLabel.classList.add('control-button');
        captureKeyboardLabel.appendChild(SvgImage.create(SvgImage.Icon.KEYBOARD));
        captureKeyboardLabel.htmlFor = captureKeyboardInput.id = `capture_keyboard_${udid}_${decoderName}`;
        captureKeyboardInput.onclick = (e: MouseEvent) => {
            const checkbox = e.target as HTMLInputElement;
            connection.setHandleKeyboardEvents(checkbox.checked);
        };
        this.controlButtons.appendChild(captureKeyboardInput);
        this.controlButtons.appendChild(captureKeyboardLabel);
        moreBox.appendChild(cmdWrap);
        const showMoreInput = document.createElement('input');
        showMoreInput.type = 'checkbox';
        const showMoreLabel = document.createElement('label');
        showMoreLabel.title = 'More';
        showMoreLabel.classList.add('control-button');
        showMoreLabel.appendChild(SvgImage.create(SvgImage.Icon.MORE));
        showMoreLabel.htmlFor = showMoreInput.id = `show_more_${udid}_${decoderName}`;
        showMoreInput.onclick = (e: MouseEvent) => {
            const checkbox = e.target as HTMLInputElement;
            moreBox.style.display = checkbox.checked ? 'block' : 'none';
        };
        const firstChild = this.controlButtons.firstChild as ChildNode;
        this.controlButtons.insertBefore(showMoreInput, firstChild);
        this.controlButtons.insertBefore(showMoreLabel, firstChild);

        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(ev);
            }
            connection.removeDecoder(decoder);
            let parent;
            parent = deviceView.parentElement;
            if (parent) {
                parent.removeChild(deviceView);
            }
            parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            decoder.removeResizeListener(this);
        };
        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Disconnect`;
        stopBtn.onclick = stop;
        moreBox.appendChild(stopBtn);
        deviceView.appendChild(this.controlButtons);
        const video = document.createElement('div');
        video.className = 'video';
        deviceView.appendChild(video);
        deviceView.appendChild(moreBox);
        this.decoder.setParent(video);
        this.decoder.addResizeListener(this);
        connection.setErrorListener(new ErrorHandler(stop));
    }

    private getMaxSize(): Size {
        const body = document.body;
        const width = (body.clientWidth - this.controlButtons.clientWidth) & ~15;
        const height = body.clientHeight & ~15;
        return new Size(width, height);
    }

    public start(): void {
        document.body.appendChild(this.deviceView);
        const decoder = this.decoder;
        if (decoder.getPreferredVideoSetting().equals(decoder.getVideoSettings())) {
            const bounds = this.getMaxSize();
            const {
                bitrate,
                maxFps,
                iFrameInterval,
                lockedVideoOrientation,
                sendFrameMeta,
            } = decoder.getVideoSettings();
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
        this.deviceConnection.addDecoder(decoder);
    }

    public OnDeviceMessage(ev: DeviceMessage): void {
        if (ev.type !== DeviceMessage.TYPE_CLIPBOARD) {
            return;
        }
        this.input.value = ev.getText();
        this.input.select();
        document.execCommand('copy');
    }

    public onVideoResize(size: Size): void {
        // padding: 10px
        this.moreBox.style.width = `${size.width - 2 * 10}px`;
    }
}
