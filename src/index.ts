import { DeviceConnection, IErrorListener } from './DeviceConnection';
import NativeDecoder from './decoder/NativeDecoder';
import { BroadwayDecoder, CANVAS_TYPE } from './decoder/BroadwayDecoder';
import Decoder from './decoder/Decoder';
import VideoSettings from './VideoSettings';
import H264bsdDecoder from './decoder/H264bsdDecoder';
import ErrorHandler from './ErrorHandler';
import TextControlEvent from './controlEvent/TextControlEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';
import Size from './Size';
import { IDevice } from './server/ServerDeviceConnection';

interface IStartArguments {
    stream: VideoSettings;
    connection: DeviceConnection;
    decoderName: string;
    decoder: Decoder;
    deviceName: string;
}

interface IArguments {
    url: string;
    name: string;
}

class Main implements IErrorListener {
    private static inputWrapperId: string = 'inputWrap';
    private static controlsWrapperId: string = 'controlsWrap';
    private static commandsWrapperId: string = 'commandsWrap';
    private static addressInputId: string = 'deviceAddress';
    private static nameInputId: string = 'deviceName';
    private static instance?: Main;

    constructor() {
        Main.instance = this;
    }

    public static getInstance(): Main {
        return Main.instance || new Main();
    }

    public OnError(ev: string | Event): void {
        console.error(ev);
    }

    public static startNative(params: IArguments): void {
        const {url, name} = params;
        const tag = NativeDecoder.createElement();
        document.body.append(tag);
        tag.style.display = 'block';
        const decoder = new NativeDecoder(tag);
        const main = Main.getInstance();
        const decoderName = 'Native';
        const deviceName = name;
        const connection = DeviceConnection.getInstance(url);
        const stream = NativeDecoder.preferredVideoSettings;
        connection.addDecoder(decoder);
        main.start({
            connection,
            decoder,
            decoderName,
            deviceName,
            stream
        });
    }

    public static startBroadway(params: IArguments): void {
        const {url, name} = params;
        const tag = BroadwayDecoder.createElement();
        document.body.append(tag);
        tag.style.display = 'block';
        const decoder = new BroadwayDecoder(tag, CANVAS_TYPE.WEBGL);
        const main = Main.getInstance();
        const decoderName = 'Broadway';
        const deviceName = name;
        const connection = DeviceConnection.getInstance(url);
        const stream = BroadwayDecoder.preferredVideoSettings;
        connection.addDecoder(decoder);
        main.start({
            connection,
            decoder,
            decoderName,
            deviceName,
            stream
        });
    }

    public static startH264bsd(params: IArguments): void {
        const {url, name} = params;
        const tag = BroadwayDecoder.createElement();
        document.body.append(tag);
        tag.style.display = 'block';
        const decoder = new H264bsdDecoder(tag);
        const main = Main.getInstance();
        const decoderName = 'H264bsdDecoder';
        const deviceName = name;
        const connection = DeviceConnection.getInstance(url);
        const stream = H264bsdDecoder.preferredVideoSettings;
        connection.addDecoder(decoder);
        main.start({
            connection,
            decoder,
            decoderName,
            deviceName,
            stream
        });
    }

    public start(params: IStartArguments): void {
        const {connection, decoder, decoderName, deviceName, stream} = params;

        const controlsWrapper = document.getElementById(Main.controlsWrapperId);
        if (!controlsWrapper) {
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'decoder-controls-wrapper';
        const textWrap = document.createElement('div');
        textWrap.id = Main.inputWrapperId;
        const input = document.createElement('input');
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send';
        textWrap.appendChild(input);
        textWrap.appendChild(sendButton);

        wrapper.appendChild(textWrap);
        sendButton.onclick = () => {
            if (input.value) {
                connection.sendEvent(new TextControlEvent(input.value));
            }
        };
        const cmdWrap = document.createElement('div');
        cmdWrap.id = Main.commandsWrapperId;
        const codes = CommandControlEvent.CommandCodes;
        for (const command in codes) {
            if (codes.hasOwnProperty(command)) {
                const action: number = codes[command];
                const btn = document.createElement('button');
                let bitrateInput: HTMLInputElement;
                let frameRateInput: HTMLInputElement;
                let iFrameIntervalInput: HTMLInputElement;
                if (action === CommandControlEvent.CommandCodes.COMMAND_SET_VIDEO_SETTINGS) {
                    const spoiler = document.createElement('div');
                    const spoilerLabel = document.createElement('label');
                    const spoilerCheck = document.createElement('input');

                    const innerDiv = document.createElement('div');
                    const id = `spoiler_video_${deviceName}_${decoderName}_${action}`;

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
                    bitrateInput.placeholder = `bitrate (${stream.bitrate})`;
                    bitrateInput.value = stream.bitrate.toString();
                    bitrateWrap.appendChild(bitrateLabel);
                    bitrateWrap.appendChild(bitrateInput);

                    const framerateWrap = document.createElement('div');
                    const framerateLabel = document.createElement('label');
                    framerateLabel.innerText = 'Framerate:';
                    frameRateInput = document.createElement('input');
                    frameRateInput.placeholder = `framerate (${stream.frameRate})`;
                    frameRateInput.value = stream.frameRate.toString();
                    framerateWrap.appendChild(framerateLabel);
                    framerateWrap.appendChild(frameRateInput);

                    const iFrameIntervalWrap = document.createElement('div');
                    const iFrameIntervalLabel = document.createElement('label');
                    iFrameIntervalLabel.innerText = 'I-Frame Interval:';
                    iFrameIntervalInput = document.createElement('input');
                    iFrameIntervalInput.placeholder = `I-frame interval (${stream.iFrameInterval})`;
                    iFrameIntervalInput.value = stream.iFrameInterval.toString();
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
                    let event: CommandControlEvent;
                    if (action === CommandControlEvent.CommandCodes.COMMAND_SET_VIDEO_SETTINGS) {
                        const bitrate = parseInt(bitrateInput.value, 10);
                        const frameRate = parseInt(frameRateInput.value, 10);
                        const iFrameInterval = parseInt(iFrameIntervalInput.value, 10);
                        if (isNaN(bitrate) || isNaN(frameRate)) {
                            return;
                        }
                        const width = document.body.clientWidth & ~15;
                        const height = document.body.clientHeight & ~15;
                        const bounds: Size = new Size(width, height);
                        event = CommandControlEvent.createSetVideoSettingsCommand(new VideoSettings({
                            bounds,
                            bitrate,
                            frameRate,
                            iFrameInterval,
                            sendFrameMeta: false
                        }));
                    } else {
                        event = new CommandControlEvent(action);
                    }
                    connection.sendEvent(event);
                };
            }
        }
        wrapper.appendChild(cmdWrap);

        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(ev);
            }
            connection.removeDecoder(decoder);
            const tag = decoder.getElement();
            let parent;
            if (tag) {
                parent = tag.parentElement;
                if (parent) {
                    parent.removeChild(tag);
                }
            }
            parent = textWrap.parentElement;
            if (parent) {
                parent.removeChild(textWrap);
            }
            parent = cmdWrap.parentElement;
            if (parent) {
                parent.removeChild(cmdWrap);
            }
            parent = stopBtn.parentElement;
            if (parent) {
                parent.removeChild(stopBtn);
            }
            parent = wrapper.parentElement;
            if (parent) {
                parent.removeChild(wrapper);
            }
        };
        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Stop ${deviceName} (${decoderName})`;
        stopBtn.onclick = stop;
        wrapper.appendChild(stopBtn);
        controlsWrapper.appendChild(wrapper);
        connection.setErrorListener(new ErrorHandler(stop));
    }

    public listen(): void {
        const ws = new WebSocket(`ws://${location.host}/`);
        const onclick = function(this: GlobalEventHandlers): void {
            if (!(this instanceof HTMLButtonElement)) {
                return;
            }
            const addressInput = document.getElementById(Main.addressInputId);
            if (addressInput && addressInput instanceof HTMLInputElement) {
                const ip = this.getAttribute('data-ip');
                if (ip) {
                    addressInput.value = `ws://${ip}:8886/`;
                }
            }
            const deviceNameInput = document.getElementById(Main.nameInputId);
            if (deviceNameInput && deviceNameInput instanceof HTMLInputElement) {
                const name = this.getAttribute('data-udid');
                if (name) {
                    deviceNameInput.value = name;
                }
            }
        };
        ws.onclose = () => {
            console.log('Connection closed');
            setTimeout(() => {
                this.listen();
            }, 2000);
        };
        ws.onmessage = (e: MessageEvent) => {
            let data: IDevice[];
            try {
                data = JSON.parse(e.data);
            } catch (error) {
                console.error(error.message);
                console.log(e.data);
                return;
            }
            const devices = document.getElementById('devices');
            if (!devices) {
                return;
            }
            const children = devices.children;
            /* tslint:disable: prefer-for-of */
            for (let i = 0; i < children.length; i++) {
                const element = children[i];
                const udid = element.getAttribute('data-udid');
                const list = data.filter(item => item.udid === udid);
                if (!list.length) {
                    devices.removeChild(element);
                }
            }
            /* tslint:enable*/
            data.forEach(item => {
                let element = document.getElementById(item.udid);
                if (!element) {
                    element = document.createElement('button');
                    element.id = item.udid;
                    if (children.length) {
                        devices.insertBefore(element, children[0]);
                    } else {
                        devices.appendChild(element);
                    }
                    element.onclick = onclick;
                }
                let text = `${item.manufacturer} ${item.model}`;
                if (!text.trim()) {
                    text = item.udid;
                }
                element.innerText = text;
                element.setAttribute('data-udid', item.udid);
                element.setAttribute('data-ip', item.ip);
            });
        };
    }
}

window.onload = function(): void {
    const form = document.querySelector('form') as HTMLFormElement;
    if (form) {
        form.addEventListener('submit', function(event: Event): void {
            const data = new FormData(form);
            const decoderName = data.get('decoder');
            const name = (data.get('name') || '').toString();
            const url = (data.get('url') || '').toString();
            if (!url) {
                return;
            }
            switch (decoderName) {
                case 'native':
                    Main.startNative({url, name});
                    break;
                case 'broadway':
                    Main.startBroadway({url, name});
                    break;
                case 'h264bsd':
                    Main.startH264bsd({url, name});
                    break;
                default:
                    return;
            }

            console.log(decoderName, name, url);
            event.preventDefault();
        }, false);
    }
    Main.getInstance().listen();
};
