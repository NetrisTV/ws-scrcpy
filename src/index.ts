import { DeviceConnection, IErrorListener } from './DeviceConnection';
import NativeDecoder from './decoder/NativeDecoder';
import { BroadwayDecoder, CANVAS_TYPE } from './decoder/BroadwayDecoder';
import Decoder from './decoder/Decoder';
import { StreamInfo } from './StreamInfo';
import ErrorHandler from './ErrorHandler';
import TextControlEvent from './controlEvent/TextControlEvent';
import CommandControlEvent from './controlEvent/CommandControlEvent';

const wsUrl = 'ws://172.17.1.68:8886/';

interface IStartArguments {
    decoderName: string;
    decoder: Decoder;
    startText: string;
    onclick(): void;
}

class Main implements IErrorListener {
    private static inputWrapperId: string = 'inputWrap';
    private static controlsWrapperId: string = 'controlsWrap';
    private static commandsWrapperId: string = 'commandsWrap';
    private static instance?: Main;
    public decoder?: Decoder;

    constructor() {
        Main.instance = this;
    }

    public static getInstance(): Main {
        return Main.instance || new Main();
    }

    public OnError(ev: string | Event): void {
        console.error(ev);
    }

    public startNative(this: HTMLButtonElement): void {
        const tag: HTMLVideoElement = document.getElementById('videoTagId') as HTMLVideoElement;
        if (tag) {
            tag.style.display = 'block';
            const decoder = new NativeDecoder(tag);
            const main = Main.getInstance();
            const onclick = main.startNative;
            const startText = this.innerText;
            const decoderName = 'Native';
            main.decoder = decoder;
            main.start.call(this, {decoder, decoderName, startText, onclick});
        }

    }

    public startBroadway(this: HTMLButtonElement): void {
        const tag: HTMLCanvasElement = document.getElementById('canvasTagId') as HTMLCanvasElement;
        if (tag) {
            tag.style.display = 'block';
            const decoder = new BroadwayDecoder(tag, CANVAS_TYPE.WEBGL);
            const main = Main.getInstance();
            const onclick = main.startBroadway;
            const startText = this.innerText;
            const decoderName = 'Broadway';
            main.decoder = decoder;
            main.start.call(this, {decoder, decoderName, startText, onclick});
        }
    }

    public start(this: HTMLButtonElement, params: IStartArguments): void {
        const {decoder, decoderName, startText, onclick} = params;
        const screen = new DeviceConnection(decoder, wsUrl);

        this.innerText = `Stop ${decoderName}`;

        const controlsWrapper = document.getElementById(Main.controlsWrapperId);
        if (!controlsWrapper) {
            return;
        }
        const textWrap = document.createElement('div');
        textWrap.id = Main.inputWrapperId;
        const input = document.createElement('input');
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send';
        textWrap.appendChild(input);
        textWrap.appendChild(sendButton);

        controlsWrapper.appendChild(textWrap);
        sendButton.onclick = () => {
            if (input.value) {
                screen.sendEvent(new TextControlEvent(input.value));
            }
        };
        const cmdWrap = document.createElement('div');
        cmdWrap.id = Main.commandsWrapperId;
        const codes = CommandControlEvent.CommandCodes;
        for (const command in codes) {
            if (codes.hasOwnProperty(command)) {
                const action: number = codes[command];
                const btn = document.createElement('button');
                let streamInfo: StreamInfo;
                let bitrateInput: HTMLInputElement;
                let frameRateInput: HTMLInputElement;
                if (action === CommandControlEvent.CommandCodes.COMMAND_CHANGE_STREAM_PARAMETERS) {
                    let bitrate = 2000000;
                    let frameRate = 24;
                    if (decoder instanceof NativeDecoder) {
                        bitrate = 8000000;
                        frameRate = 60;
                    }
                    const bitrateWrap = document.createElement('div');
                    const bitrateLabel = document.createElement('label');
                    bitrateLabel.innerText = 'Bitrate:';
                    bitrateInput = document.createElement('input');
                    bitrateInput.placeholder = `bitrate (${bitrate})`;
                    bitrateInput.value = bitrate.toString();

                    const framerateWrap = document.createElement('div');
                    const framerateLabel = document.createElement('label');
                    framerateLabel.innerText = 'Framerate:';
                    frameRateInput = document.createElement('input');
                    frameRateInput.placeholder = `framerate (${frameRate})`;
                    frameRateInput.value = frameRate.toString();

                    bitrateWrap.appendChild(bitrateLabel);
                    bitrateWrap.appendChild(bitrateInput);
                    cmdWrap.appendChild(bitrateWrap);
                    framerateWrap.appendChild(framerateLabel);
                    framerateWrap.appendChild(frameRateInput);
                    cmdWrap.appendChild(framerateWrap);
                }
                btn.innerText = command;
                btn.onclick = () => {
                    let buffer;
                    if (action === CommandControlEvent.CommandCodes.COMMAND_CHANGE_STREAM_PARAMETERS) {
                        const bitrate = parseInt(bitrateInput.value, 10);
                        const frameRate = parseInt(frameRateInput.value, 10);
                        if (isNaN(bitrate) || isNaN(frameRate)) {
                            return;
                        }
                        streamInfo = new StreamInfo({
                            width: (document.body.clientWidth / 8 | 0) * 8,
                            height: (document.body.clientHeight / 8 | 0) * 8,
                            bitrate,
                            frameRate
                        });
                        buffer = streamInfo.toBuffer();
                    }
                    screen.sendEvent(new CommandControlEvent(action, buffer));
                };
                cmdWrap.appendChild(btn);
            }
        }
        controlsWrapper.appendChild(cmdWrap);

        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(ev);
            }
            screen.stop();
            this.innerText = startText;
            this.onclick = onclick;
            const tag = decoder.getElement();
            if (tag) {
                tag.style.display = 'none';
            }
            let parent;
            parent = textWrap.parentElement;
            if (parent) {
                parent.removeChild(textWrap);
            }
            parent = cmdWrap.parentElement;
            if (parent) {
                parent.removeChild(cmdWrap);
            }
        };

        this.onclick = stop;

        screen.setErrorListener(new ErrorHandler(stop));
    }
}

window.onload = function(): void {
    const btnNative = document.getElementById('startNative');
    if (btnNative && btnNative instanceof HTMLButtonElement) {
        btnNative.onclick = Main.getInstance().startNative.bind(btnNative);
    }
    const btnBroadway = document.getElementById('startBroadway');
    if (btnBroadway && btnBroadway instanceof HTMLButtonElement) {
        btnBroadway.onclick = Main.getInstance().startBroadway.bind(btnBroadway);
    }
};
