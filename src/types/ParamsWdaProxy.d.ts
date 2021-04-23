import { ParamsBase } from './ParamsBase';
import { ACTION } from '../common/Action';

export interface ParamsWdaProxy extends ParamsBase {
    action: ACTION.PROXY_WDA;
    udid: string;
}
