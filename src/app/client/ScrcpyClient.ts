import MseDecoder from '../decoder/MseDecoder';
import { DeviceController } from '../DeviceController';
import BroadwayDecoder from '../decoder/BroadwayDecoder';
import { ParsedUrlQueryInput } from 'querystring';
import { BaseClient } from './BaseClient';
import Decoder from '../decoder/Decoder';
import Tinyh264Decoder from '../decoder/Tinyh264Decoder';

export type Decoders = 'broadway' | 'mse' | 'tinyh264';

export interface StreamParams extends ParsedUrlQueryInput {
    action: 'stream';
    udid: string;
    decoder: Decoders;
    ip: string;
    port: string;
}

export class ScrcpyClient extends BaseClient {
    public static ACTION = 'stream';
    private static instance?: ScrcpyClient;
    public static start(params: StreamParams): ScrcpyClient {
        const client = this.getInstance();
        client.startStream(params.udid, params.decoder, `ws://${params.ip}:${params.port}`);
        client.setBodyClass('stream');
        client.setTitle(`${params.udid} stream`);

        return client;
    }

    constructor() {
        super();
        ScrcpyClient.instance = this;
    }

    public static getInstance(): ScrcpyClient {
        return ScrcpyClient.instance || new ScrcpyClient();
    }

    public startStream(udid: string, decoderName: Decoders, url: string): Decoder | undefined {
        if (!url || !udid) {
            return;
        }
        let decoderClass: new (udid: string) => Decoder;
        switch (decoderName) {
            case 'mse':
                decoderClass = MseDecoder;
                break;
            case 'broadway':
                decoderClass = BroadwayDecoder;
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
            decoder,
        });
        controller.start();
        console.log(decoder.getName(), udid, url);
        return decoder;
    }
}
