import { ACTION } from '../common/Action';
import { ParamsStream } from './ParamsStream';

export interface ParamsStreamQVHack extends ParamsStream {
    action: ACTION.STREAM_WS_QVH;
    player?: string;
}
