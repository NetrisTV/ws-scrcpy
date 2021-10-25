import { ParamsStream } from '../../../types/ParamsStream';
import { ACTION } from '../../../common/Action';
import { ParsedUrlQuery } from 'querystring';
import { StreamClient } from './StreamClient';
import { BasePlayer, PlayerClass } from '../../player/BasePlayer';

const TAG = '[StreamClientMJPEG]';

export class StreamClientMJPEG extends StreamClient<ParamsStream> {
    public static ACTION = ACTION.STREAM_MJPEG;
    protected static players: Map<string, PlayerClass> = new Map<string, PlayerClass>();

    public static start(params: ParsedUrlQuery | ParamsStream): StreamClientMJPEG {
        return new StreamClientMJPEG(params);
    }

    constructor(params: ParsedUrlQuery | ParamsStream) {
        super(params);
        this.name = `[${TAG}:${this.udid}]`;
        this.udid = this.params.udid;
        this.runWebDriverAgent().then(() => {
            this.startStream();
            this.player?.play();
        });
    }

    public get action(): string {
        return StreamClientMJPEG.ACTION;
    }

    public createPlayer(udid: string, playerName?: string): BasePlayer {
        return StreamClientMJPEG.createPlayer(udid, playerName);
    }

    public getDeviceName(): string {
        return this.deviceName;
    }
}
