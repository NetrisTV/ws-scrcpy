import Decoder from './decoder/Decoder';
import { DeviceConnection, DeviceMessageListener } from './DeviceConnection';
import VideoSettings from './VideoSettings';
import ErrorHandler from './ErrorHandler';
import KeyCodeControlEvent from './controlEvent/KeyCodeControlEvent';
import KeyEvent from './android/KeyEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';
import ControlEvent from './controlEvent/ControlEvent';
import TextControlEvent from './controlEvent/TextControlEvent';
import DeviceMessage from './DeviceMessage';
import SvgImage from "./ui/SvgImage";

export interface DeviceControllerParams {
    url: string;
    udid: string;
    decoder: Decoder;
}

export class DeviceController implements DeviceMessageListener {
    public readonly decoder: Decoder;
    public readonly controls: HTMLDivElement;
    public readonly deviceView: HTMLDivElement;
    public readonly input: HTMLInputElement;
    private readonly controlButtons: HTMLElement;

    constructor(params: DeviceControllerParams) {
        const decoder = this.decoder = params.decoder;
        const udid = params.udid;
        const decoderName = this.decoder.getName();
        const controlsWrapper = this.controls = document.createElement('div');
        const deviceView = this.deviceView = document.createElement('div');
        deviceView.className = 'device-view';
        const connection = DeviceConnection.getInstance(udid, params.url);
        const videoSettings = decoder.getVideoSettings();
        connection.addDecoder(this.decoder);
        connection.setDeviceMessageListener(this);
        const wrapper = document.createElement('div');
        wrapper.className = 'decoder-controls-wrapper menu';
        const menuCheck = document.createElement('input');
        menuCheck.type = 'checkbox';
        menuCheck.checked = true;
        const menuLabel = document.createElement('label');
        menuLabel.htmlFor = menuCheck.id = `controls_${udid}_${decoderName}`;
        // label.innerText = `${deviceName} (${decoderName})`;
        wrapper.appendChild(menuCheck);
        wrapper.appendChild(menuLabel);
        const box = document.createElement('div');
        box.className = 'box';
        wrapper.appendChild(box);
        const textWrap = document.createElement('div');
        const input = this.input = document.createElement('input');
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send as keys';
        textWrap.appendChild(input);
        textWrap.appendChild(sendButton);

        box.appendChild(textWrap);
        sendButton.onclick = () => {
            if (input.value) {
                connection.sendEvent(new TextControlEvent(input.value));
            }
        };
        const sendKeyEventsWrap = document.createElement('div');
        const sendKeyEventsCheck = document.createElement('input');
        sendKeyEventsCheck.type = 'checkbox';
        const sendKeyEventsLabel = document.createElement('label');
        sendKeyEventsLabel.innerText = 'Capture keyboard events';
        sendKeyEventsLabel.htmlFor = sendKeyEventsCheck.id = `sendkeys_${udid}_${decoderName}`;
        sendKeyEventsWrap.appendChild(sendKeyEventsCheck);
        sendKeyEventsWrap.appendChild(sendKeyEventsLabel);
        box.appendChild(sendKeyEventsWrap);
        sendKeyEventsCheck.onclick = (e: MouseEvent) => {
            const checkbox = e.target as HTMLInputElement;
            connection.setHandleKeyboardEvents(checkbox.checked);
        }

        this.controlButtons = document.createElement('div');
        this.controlButtons.className = 'control-buttons-list';
        const cmdWrap = document.createElement('div');
        const codes = CommandControlEvent.CommandCodes;
        for (const command in codes) {
            if (codes.hasOwnProperty(command)) {
                const action: number = codes[command];
                const btn = document.createElement('button');
                let bitrateInput: HTMLInputElement;
                let frameRateInput: HTMLInputElement;
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

                    const framerateWrap = document.createElement('div');
                    const framerateLabel = document.createElement('label');
                    framerateLabel.innerText = 'Framerate:';
                    frameRateInput = document.createElement('input');
                    frameRateInput.placeholder = `framerate (${videoSettings.frameRate})`;
                    frameRateInput.value = videoSettings.frameRate.toString();
                    framerateWrap.appendChild(framerateLabel);
                    framerateWrap.appendChild(frameRateInput);

                    const iFrameIntervalWrap = document.createElement('div');
                    const iFrameIntervalLabel = document.createElement('label');
                    iFrameIntervalLabel.innerText = 'I-Frame Interval:';
                    iFrameIntervalInput = document.createElement('input');
                    iFrameIntervalInput.placeholder = `I-frame interval (${videoSettings.iFrameInterval})`;
                    iFrameIntervalInput.value = videoSettings.iFrameInterval.toString();
                    iFrameIntervalWrap.appendChild(iFrameIntervalLabel);
                    iFrameIntervalWrap.appendChild(iFrameIntervalInput);

                    innerDiv.appendChild(bitrateWrap);
                    innerDiv.appendChild(framerateWrap);
                    innerDiv.appendChild(iFrameIntervalWrap);
                    innerDiv.appendChild(btn);
                    cmdWrap.appendChild(spoiler);
                } else {
                    cmdWrap.appendChild(btn);
                }
                btn.innerText = CommandControlEvent.CommandNames[action];
                btn.onclick = () => {
                    let event: CommandControlEvent|undefined;
                    if (action === ControlEvent.TYPE_CHANGE_STREAM_PARAMETERS) {
                        const bitrate = parseInt(bitrateInput.value, 10);
                        const frameRate = parseInt(frameRateInput.value, 10);
                        const iFrameInterval = parseInt(iFrameIntervalInput.value, 10);
                        if (isNaN(bitrate) || isNaN(frameRate)) {
                            return;
                        }
                        const maxSize = this.getMaxSize();
                        event = CommandControlEvent.createSetVideoSettingsCommand(new VideoSettings({
                            maxSize,
                            bitrate,
                            frameRate,
                            iFrameInterval,
                            lockedVideoOrientation: -1,
                            sendFrameMeta: false
                        }));
                    } else if (action === CommandControlEvent.TYPE_SET_CLIPBOARD) {
                        const text = input.value;
                        if (text) {
                            event = CommandControlEvent.createSetClipboard(text);
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
        const list = [{
            title: 'Power',
            code: KeyEvent.KEYCODE_POWER,
            icon: SvgImage.Icon.POWER
        },{
            title: 'Volume-',
            code: KeyEvent.KEYCODE_VOLUME_DOWN,
            icon: SvgImage.Icon.VOLUME_DOWN
        },{
            title: 'Volume+',
            code: KeyEvent.KEYCODE_VOLUME_UP,
            icon: SvgImage.Icon.VOLUME_UP
        },{
            title: 'Back',
            code: KeyEvent.KEYCODE_BACK,
            icon: SvgImage.Icon.BACK
        },{
            title: 'Home',
            code: KeyEvent.KEYCODE_HOME,
            icon: SvgImage.Icon.HOME
        }, {
            title: 'Switch app',
            code: KeyEvent.KEYCODE_APP_SWITCH,
            icon: SvgImage.Icon.OVERVIEW
        }];
        list.forEach(item => {
            const {code, icon, title} = item;
            const btn = document.createElement('button');
            btn.classList.add('control-button');
            btn.title = title;
            btn.appendChild(SvgImage.create(icon));
            btn.onmousedown = () => {
                const event = new KeyCodeControlEvent(KeyEvent.ACTION_DOWN, code, 0);
                connection.sendEvent(event);
            };
            btn.onmouseup = () => {
                const event = new KeyCodeControlEvent(KeyEvent.ACTION_UP, code, 0);
                connection.sendEvent(event);
            };
            this.controlButtons.appendChild(btn);
        });
        if (decoder.supportsScreenshot) {
            const screenshotButton = document.createElement('button');
            screenshotButton.classList.add('control-button');
            screenshotButton.title = 'Save screenshot';
            screenshotButton.appendChild(SvgImage.create(SvgImage.Icon.CAMERA));
            screenshotButton.onclick = () => {
                decoder.createScreenshot(connection.getDeviceName());
            }
            this.controlButtons.appendChild(screenshotButton);
        }
        box.appendChild(cmdWrap);

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
            parent = controlsWrapper.parentElement;
            if (parent) {
                parent.removeChild(controlsWrapper);
            }
        };
        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Disconnect`;
        stopBtn.onclick = stop;
        box.appendChild(stopBtn);
        controlsWrapper.appendChild(wrapper);
        deviceView.appendChild(this.controlButtons);
        const video = document.createElement('div');
        video.className = 'video';
        deviceView.appendChild(video);
        this.decoder.setParent(video);
        connection.setErrorListener(new ErrorHandler(stop));
    }

    private getMaxSize(): number {
        const body = document.body;
        const width = (body.clientWidth - this.controlButtons.clientWidth) & ~15;
        const height = body.clientHeight & ~15;
        return Math.min(width, height);
    }

    public start(): void {
        document.body.appendChild(this.deviceView);
        const temp = document.getElementById('controlsWrap');
        if (temp) {
            temp.appendChild(this.controls);
        }
    }

    public OnDeviceMessage(ev: DeviceMessage): void {
        switch (ev.type) {
            case DeviceMessage.TYPE_CLIPBOARD:
                this.input.value = ev.getText();
                this.input.select();
                document.execCommand('copy');
                break;
            default:
                console.error(`Unknown message type: ${ev.type}`);
        }
    }

}
