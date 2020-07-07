import NativeDecoder from '../decoder/NativeDecoder';
import { DeviceController } from '../DeviceController';
import { BroadwayDecoder } from '../decoder/BroadwayDecoder';
import H264bsdDecoder from '../decoder/H264bsdDecoder';
import { ParsedUrlQueryInput } from 'querystring';
import { BaseClient } from './BaseClient';
import Decoder from '../decoder/Decoder';
import Tinyh264Decoder from "../decoder/Tinyh264Decoder";

export interface Arguments {
    url: string;
    name: string;
}

export type Decoders = 'broadway' | 'h264bsd' | 'native' | 'tinyh264';

export interface StreamParams extends ParsedUrlQueryInput {
    action: 'stream';
    udid: string;
    decoder: Decoders;
    ip: string;
    port: string;
    showFps?: boolean;
}

export class ScrcpyClient extends BaseClient {
    public static ACTION: string = 'stream';
    private static instance?: ScrcpyClient;
    public static start(params: StreamParams): ScrcpyClient {
        this.getOrCreateControlsWrapper();
        const client = this.getInstance();
        const decoder = client.startStream(params.udid, params.decoder, `ws://${params.ip}:${params.port}`);
        if (decoder) {
            decoder.showFps = !!params.showFps;
        }
        client.setTitle(`WS scrcpy ${params.decoder} ${params.udid}`);

        return client;
    }

    constructor() {
        super();
        ScrcpyClient.instance = this;
    }

    public static getInstance(): ScrcpyClient {
        return ScrcpyClient.instance || new ScrcpyClient();
    }

    public static getOrCreateControlsWrapper(): HTMLDivElement {
        let controlsWrap = document.getElementById('controlsWrap') as HTMLDivElement;
        if (!controlsWrap) {
            controlsWrap = document.createElement('div');
            controlsWrap.id = 'controlsWrap';
            document.body.appendChild(controlsWrap);
        }
        return controlsWrap;
    }

    public static startNative(params: Arguments): Decoder {
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
        return decoder;
    }

    public static startBroadway(params: Arguments): Decoder {
        const {url, name} = params;
        const tag = BroadwayDecoder.createElement();
        const decoder = new BroadwayDecoder(tag);
        const controller = new DeviceController({
            url,
            name,
            decoder,
            videoSettings: BroadwayDecoder.preferredVideoSettings
        });
        controller.start();
        return decoder;
    }

    public static startH264bsd(params: Arguments): Decoder {
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
        return decoder;
    }

    public static startTinyh264(params: Arguments): Decoder {
        const {url, name} = params;
        const tag = Tinyh264Decoder.createElement();
        const decoder = new Tinyh264Decoder(tag);
        const controller = new DeviceController({
            url,
            name,
            decoder,
            videoSettings: Tinyh264Decoder.preferredVideoSettings
        });
        controller.start();
        return decoder;
    }

    public startStream(name: string, decoderName: string, url: string): Decoder | undefined {
        if (!url || !name) {
            return;
        }
        let decoder: Decoder;
        switch (decoderName) {
            case 'native':
                decoder = ScrcpyClient.startNative({url, name});
                break;
            case 'broadway':
                decoder = ScrcpyClient.startBroadway({url, name});
                break;
            case 'h264bsd':
                decoder = ScrcpyClient.startH264bsd({url, name});
                break;
            case 'tinyh264':
                decoder = ScrcpyClient.startTinyh264({url, name});
                break;
            default:
                return;
        }
        console.log(decoderName, name, url);
        return decoder;
    }
}
