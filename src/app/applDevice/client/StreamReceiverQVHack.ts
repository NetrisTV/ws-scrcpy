import { StreamReceiver } from '../../client/StreamReceiver';
import { ParsedUrlQuery } from 'querystring';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';
import { ParamsStreamQVHack } from '../../../types/ParamsStreamQVHack';

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
}
