import {TextControlEvent, CommandControlEvent} from "./ControlEvent";
import {DeviceScreen, DeviceScreenErrorListener} from "./DeviceScreen";

const wsUrl = 'ws://172.17.1.68:8886/';

class Main implements DeviceScreenErrorListener {
    private static inputWrapperId = 'inputWrap';
    private static controlsWrapperId = 'controlsWrap';
    private static commandsWrapperId = 'commandsWrap';
    private screen?: DeviceScreen;
    private static instance?: Main;

    constructor() {
        Main.instance = this;
    }

    public static getInstance(): Main {
        return Main.instance || new Main();
    }

    public OnError(ev: string | Event) {
        console.error(ev);
    }

    public stop(this:HTMLButtonElement): void {
        const main = Main.getInstance();
        const screen = main.screen;
        if (screen) {
            screen.stop();
        }
        this.innerText = 'Start';
        this.onclick = main.start.bind(this);
        const textWrap = document.getElementById(Main.inputWrapperId);
        if (textWrap) {
            (<HTMLElement>textWrap.parentElement).removeChild(textWrap);
        }

        const cmdWrap = document.getElementById(Main.commandsWrapperId);
        if (cmdWrap) {
            (<HTMLElement>cmdWrap.parentElement).removeChild(cmdWrap);
        }
    }

    public start(this:HTMLButtonElement): void {
        const main = Main.getInstance();
        const element: HTMLVideoElement = <HTMLVideoElement>document.getElementById('videoTagId');
        const screen = new DeviceScreen(element, wsUrl);
        screen.setErrorListener(main);
        main.screen = screen;

        this.innerText = 'Stop';
        this.onclick = main.stop.bind(this);

        const textWrap = document.createElement('div');
        textWrap.id = Main.inputWrapperId;
        const input = document.createElement('input');
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send';
        textWrap.appendChild(input);
        textWrap.appendChild(sendButton);
        (<HTMLElement>document.getElementById(Main.controlsWrapperId)).appendChild(textWrap);
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
        (<HTMLElement>document.getElementById(Main.controlsWrapperId)).appendChild(cmdWrap);
    }
}

window.onload = function() {
    const btn: HTMLButtonElement = <HTMLButtonElement>document.getElementById('start');
    btn.onclick = Main.getInstance().start.bind(btn);
};
