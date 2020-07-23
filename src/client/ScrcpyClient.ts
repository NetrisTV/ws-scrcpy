import NativeDecoder from '../decoder/NativeDecoder';
import { DeviceController } from '../DeviceController';
import BroadwayDecoder from '../decoder/BroadwayDecoder';
import H264bsdDecoder from '../decoder/H264bsdDecoder';
import { ParsedUrlQueryInput } from 'querystring';
import { BaseClient } from './BaseClient';
import Decoder from '../decoder/Decoder';
import Tinyh264Decoder from "../decoder/Tinyh264Decoder";

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

    public startStream(udid: string, decoderName: string, url: string): Decoder | undefined {
        if (!url || !udid) {
            return;
        }
        let decoderClass: new (udid: string) => Decoder;
        switch (decoderName) {
            case 'native':
                decoderClass = NativeDecoder;
                break;
            case 'broadway':
                decoderClass = BroadwayDecoder;
                break;
            case 'h264bsd':
                decoderClass = H264bsdDecoder
                break;
            case 'tinyh264':
                decoderClass = Tinyh264Decoder;
                break;
            default:
                return;
        }
        const decoder = new decoderClass(udid);
        const controller = new DeviceController({
            url,
            udid,
            decoder
        });
        controller.start();
        console.log(decoder.getName(), udid, url);
        return decoder;
    }
}
