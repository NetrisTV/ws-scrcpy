import { ACTION } from '../common/Action';
import { ParamsBase } from './ParamsBase';

export interface ParamsDevtools extends ParamsBase {
    action: ACTION.DEVTOOLS;
    udid: string;
}
