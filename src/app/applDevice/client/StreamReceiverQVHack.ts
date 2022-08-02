import { StreamReceiver } from '../../client/StreamReceiver';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';
import { ParamsStream } from '../../../types/ParamsStream';
import { ChannelCode } from '../../../common/ChannelCode';

export class StreamReceiverQVHack extends StreamReceiver<ParamsStream> {
    public static parseParameters(params: URLSearchParams): ParamsStream {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.STREAM_WS_QVH) {
            throw Error('Incorrect action');
        }
        return {
            ...typedParams,
            action,
            player: Util.parseString(params, 'player', true),
            udid: Util.parseString(params, 'udid', true),
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
