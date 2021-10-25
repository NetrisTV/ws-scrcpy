import { StreamReceiver } from '../../client/StreamReceiver';
import { ParsedUrlQuery } from 'querystring';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';
import { ParamsStreamQVHack } from '../../../types/ParamsStreamQVHack';
import { ChannelCode } from '../../../common/ChannelCode';

export class StreamReceiverQVHack extends StreamReceiver<ParamsStreamQVHack> {
    public parseParameters(params: ParsedUrlQuery): ParamsStreamQVHack {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.STREAM_WS_QVH) {
            throw Error('Incorrect action');
        }
        return {
            ...typedParams,
            action,
            udid: Util.parseStringEnv(params.udid),
        };
    }

    protected supportMultiplexing(): boolean {
        return true;
    }

    protected getChannelInitData(): Buffer {
        const udid = Util.stringToUtf8ByteArray(this.params.udid);
        const buffer = Buffer.alloc(4 + 4 + udid.byteLength);
        buffer.write(ChannelCode.QVHS, 'ascii');
        buffer.writeUInt32LE(udid.length, 4);
        buffer.set(udid, 8);
        return buffer;
    }
}
