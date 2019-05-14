import MotionEvent from "./MotionEvent";
import VideoConverter from "h264-converter";
import {MotionControlEvent, TextControlEvent, CommandControlEvent} from "./ControlEvent";
import Position from "./Position";
import Size from "./Size";
import Point from "./Point";
import {StreamInfo} from "./StreamInfo";

export const MESSAGE_TYPE_TEXT = "text";
export const MESSAGE_TYPE_STREAM_INFO = "stream_info";
const wsUrl = 'ws://172.17.1.68:8886/';
const DEFAULT_FPF = 1;

class Main {
    private static websocket: WebSocket;
    private static converter: VideoConverter;
    private static inputWrapperId = 'inputWrap';
    private static controlsWrapperId = 'controlsWrap';
    private static commandsWrapperId = 'commandsWrap';

    private static BUTTONS_MAP: Record<number, number> = {
        0: 17, // ?? BUTTON_PRIMARY
        1: MotionEvent.BUTTON_TERTIARY,
        2: 26  // ?? BUTTON_SECONDARY
    };

    private static EVENT_ACTION_MAP: Record<string, number> = {
        'mousedown': MotionEvent.ACTION_DOWN,
        'mousemove': MotionEvent.ACTION_MOVE,
        'mouseup': MotionEvent.ACTION_UP,
    };

    public static haveConnection(): boolean {
        const websocket = Main.websocket;
        return websocket && websocket.readyState === websocket.OPEN;
    }

    public static buildMotionEvent(e: MouseEvent, streamInfo: StreamInfo): MotionControlEvent | null {
        const action = Main.EVENT_ACTION_MAP[e.type];
        if (typeof action === 'undefined' || !streamInfo) {
            return null;
        }
        const width = streamInfo.width;
        const height = streamInfo.height;
        const target: HTMLElement = <HTMLElement> e.target;
        let {clientWidth, clientHeight} = target;
        let touchX = (e.clientX - target.offsetLeft);
        let touchY = (e.clientY - target.offsetTop);
        const eps = 1e5;
        const ratio = width / height;
        if (Math.round(eps * ratio) > Math.round(eps * clientWidth / clientHeight)) {
            const realHeight = Math.ceil(clientWidth / ratio);
            const top = (clientHeight - realHeight) / 2;
            if (touchY < top || touchY > top + realHeight) {
                return null;
            }
            touchY -= top;
            clientHeight = realHeight;
        }
        const x = touchX * width / clientWidth;
        const y = touchY * height / clientHeight;
        const position = new Position(new Point(x, y), new Size(width, height));
        return new MotionControlEvent(action, Main.BUTTONS_MAP[e.button], position);
    }

    public static stop(this:HTMLButtonElement): void {
        if (Main.haveConnection()) {
            Main.websocket.close();
        }
        if (Main.converter) {
            Main.converter.pause();
        }
        this.innerText = 'Start';
        this.onclick = Main.start.bind(this);
        const textWrap = document.getElementById(Main.inputWrapperId);
        if (textWrap) {
            (<HTMLElement>textWrap.parentElement).removeChild(textWrap);
        }

        const cmdWrap = document.getElementById(Main.commandsWrapperId);
        if (cmdWrap) {
            (<HTMLElement>cmdWrap.parentElement).removeChild(cmdWrap);
        }
    }

    public static start(this:HTMLButtonElement): void {
        const element: HTMLVideoElement = <HTMLVideoElement>document.getElementById('videoTagId');
        let converter: VideoConverter;
        let streamInfo: StreamInfo;

        Main.websocket = new WebSocket(wsUrl);
        Main.websocket.binaryType = 'arraybuffer';

        Main.websocket.addEventListener('error', function(this: HTMLButtonElement, e: Event) {
            console.error(e);
            if (Main.websocket.readyState === Main.websocket.CLOSED) {
                Main.stop.apply(this);
            }
        }.bind(this));
        Main.websocket.addEventListener('message', function(e: MessageEvent) {
            if (e.data instanceof ArrayBuffer && typeof converter !== 'undefined') {
                converter.appendRawData(new Uint8Array(e.data));
            } else {
                let data;
                try {
                    data = JSON.parse(e.data);
                } catch (e) {
                    console.log(e.data);
                    return;
                }
                switch (data.type) {
                    case MESSAGE_TYPE_STREAM_INFO:
                        const newInfo = new StreamInfo(data);
                        if (converter && streamInfo && !streamInfo.equals(newInfo)) {
                            converter.appendRawData(new Uint8Array([]));
                            converter.pause();
                        }
                        streamInfo = newInfo;
                        converter = new VideoConverter(element, streamInfo.frameRate, DEFAULT_FPF);
                        converter.play();
                        break;
                    case MESSAGE_TYPE_TEXT:
                        console.log(data.message);
                        break;
                    default:
                        console.log(e.data);
                }
            }
        }, false);

        this.innerText = 'Stop';
        this.onclick = Main.stop.bind(this);

        const textWrap = document.createElement('div');
        textWrap.id = Main.inputWrapperId;
        const input = document.createElement('input');
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send';
        textWrap.appendChild(input);
        textWrap.appendChild(sendButton);
        (<HTMLElement>document.getElementById(Main.controlsWrapperId)).appendChild(textWrap);
        sendButton.onclick = function() {
            if (Main.haveConnection()) {
                if (input.value) {
                    const event = new TextControlEvent(input.value);
                    Main.websocket.send(event.toBuffer());
                }
            }
        };
        const cmdWrap = document.createElement('div');
        cmdWrap.id = Main.commandsWrapperId;
        for (let command in CommandControlEvent) if (CommandControlEvent.hasOwnProperty(command)) {
            const btn = document.createElement('button');
            btn.innerText = command;
            btn.onclick = function() {
                if (Main.haveConnection()) {
                    // FIXME: remove <any>
                    const action: number = (<any>CommandControlEvent)[command];
                    Main.websocket.send(new CommandControlEvent(action).toBuffer())
                }
            };
            cmdWrap.appendChild(btn);
        }
        (<HTMLElement>document.getElementById(Main.controlsWrapperId)).appendChild(cmdWrap);

        document.body.oncontextmenu = function(e) {
            e.preventDefault();
            return false;
        };

        let down = 0;

        function onMouseEvent(e: MouseEvent) {
            if (e.target === element && Main.haveConnection()) {
                const event = Main.buildMotionEvent(e, streamInfo);
                if (event) {
                    Main.websocket.send(event.toBuffer());
                }
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            return true;
        }

        document.body.onmousedown = function(e) {
            down++;
            onMouseEvent(e);
        };
        document.body.onmouseup = function(e) {
            down--;
            onMouseEvent(e);
        };
        document.body.onmousemove = function(e) {
            if (down > 0) {
                onMouseEvent(e);
            }
        };
    }
}

window.onload = function() {
    const btn: HTMLButtonElement = <HTMLButtonElement>document.getElementById('start');
    btn.onclick = Main.start.bind(btn);
};
