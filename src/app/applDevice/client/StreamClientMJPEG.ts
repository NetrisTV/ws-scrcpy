import { ParamsStream } from '../../../types/ParamsStream';
import { ACTION } from '../../../common/Action';
import { ParsedUrlQuery } from 'querystring';
import { StreamClient } from './StreamClient';
import { BasePlayer, PlayerClass } from '../../player/BasePlayer';
import { WdaStatus } from '../../../common/WdaStatus';

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
        this.on('wda:status', (status) => {
            if (status === WdaStatus.STOPPED) {
                this.player?.stop();
            } else if (status === WdaStatus.STARTED) {
                this.player?.play();
            }
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
