import NativeDecoder from './decoder/NativeDecoder';
import { BroadwayDecoder, CANVAS_TYPE } from './decoder/BroadwayDecoder';
import H264bsdDecoder from './decoder/H264bsdDecoder';
import { IDevice } from './server/ServerDeviceConnection';
import { DeviceController } from './DeviceController';

interface IArguments {
    url: string;
    name: string;
}

class Main {
    private static addressInputId: string = 'deviceAddress';
    private static nameInputId: string = 'deviceName';
    private static instance?: Main;

    constructor() {
        Main.instance = this;
    }

    public static getInstance(): Main {
        return Main.instance || new Main();
    }

    public static startNative(params: IArguments): void {
        const {url, name} = params;
        const tag = NativeDecoder.createElement();
        const decoder = new NativeDecoder(tag);
        const controller = new DeviceController({
            url,
            name,
            decoder,
            videoSettings: NativeDecoder.preferredVideoSettings
        });
        controller.start();
    }

    public static startBroadway(params: IArguments): void {
        const {url, name} = params;
        const tag = BroadwayDecoder.createElement();
        const decoder = new BroadwayDecoder(tag, CANVAS_TYPE.WEBGL);
        const controller = new DeviceController({
            url,
            name,
            decoder,
            videoSettings: BroadwayDecoder.preferredVideoSettings
        });
        controller.start();
    }

    public static startH264bsd(params: IArguments): void {
        const {url, name} = params;
        const tag = H264bsdDecoder.createElement();
        const decoder = new H264bsdDecoder(tag);
        const controller = new DeviceController({
            url,
            name,
            decoder,
            videoSettings: H264bsdDecoder.preferredVideoSettings
        });
        controller.start();
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
