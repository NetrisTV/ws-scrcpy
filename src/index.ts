import {CommandControlEvent, TextControlEvent} from "./ControlEvent";
import {DeviceScreen, DeviceScreenErrorListener} from "./DeviceScreen";
import NativeDecoder from "./decoder/NativeDecoder";
import {BroadwayDecoder, CANVAS_TYPE} from "./decoder/BroadwayDecoder";
import Decoder from "./decoder/Decoder";

const wsUrl = 'ws://172.17.1.68:8886/';

interface StartArguments {
    decoder: Decoder,
    startText: string,
    onclick: () => void
}

class Main implements DeviceScreenErrorListener {
    private static inputWrapperId = 'inputWrap';
    private static controlsWrapperId = 'controlsWrap';
    private static commandsWrapperId = 'commandsWrap';
    private static instance?: Main;
    public decoder?: Decoder;
    private screen?: DeviceScreen;

    constructor() {
        Main.instance = this;
    }

    public static getInstance(): Main {
        return Main.instance || new Main();
    }

    public OnError(ev: string | Event) {
        console.error(ev);
    }

    public startNative(this: HTMLButtonElement) {
        const tag: HTMLVideoElement = <HTMLVideoElement>document.getElementById('videoTagId');
        if (tag) {
            tag.style.display = 'block';
            const decoder = new NativeDecoder(tag);
            const main = Main.getInstance();
            const onclick = main.startNative;
            const startText = this.innerText;
            main.decoder = decoder;
            main.start.call(this, {decoder, startText, onclick});
        }

    }

    public startBroadway(this: HTMLButtonElement) {
        const tag: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('canvasTagId');
        if (tag) {
            tag.style.display = 'block';
            const decoder = new BroadwayDecoder(tag, CANVAS_TYPE.WEBGL);
            const main = Main.getInstance();
            const onclick = main.startBroadway;
            const startText = this.innerText;
            main.decoder = decoder;
            main.start.call(this, {decoder, startText, onclick});
        }
    }

    public start(this: HTMLButtonElement, params: StartArguments): void {
        const {decoder, startText, onclick} = params;
        const main = Main.getInstance();
        const screen = new DeviceScreen(decoder, wsUrl);
        screen.setErrorListener(main);
        main.screen = screen;

        this.innerText = 'Stop';

        const controlsWrapper = document.getElementById(Main.controlsWrapperId);
        if (!controlsWrapper) {
            return
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
                const screen = Main.getInstance().screen;
                if (screen) {
                    screen.sendEvent(new TextControlEvent(input.value));
                }
            }
        };
        const cmdWrap = document.createElement('div');
        cmdWrap.id = Main.commandsWrapperId;
        const codes = CommandControlEvent.CommandCodes;
        for (let command in codes) if (codes.hasOwnProperty(command)) {
            const btn = document.createElement('button');
            btn.innerText = command;
            btn.onclick = () => {
                const screen = Main.getInstance().screen;
                if (screen) {
                    const action: number = codes[command];
                    screen.sendEvent(new CommandControlEvent(action));
                }
            };
            cmdWrap.appendChild(btn);
        }
        controlsWrapper.appendChild(cmdWrap);


        this.onclick = () => {
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
    }
}

window.onload = function () {
    const btnNative: HTMLButtonElement = <HTMLButtonElement>document.getElementById('startNative');
    btnNative.onclick = Main.getInstance().startNative.bind(btnNative);
    const btnBroadway: HTMLButtonElement = <HTMLButtonElement>document.getElementById('startBroadway');
    btnBroadway.onclick = Main.getInstance().startBroadway.bind(btnBroadway);
};
