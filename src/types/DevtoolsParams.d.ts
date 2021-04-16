import { ParsedUrlQueryInput } from 'querystring';
import { ACTION } from '../common/Action';

export interface DevtoolsParams extends ParsedUrlQueryInput {
    action: ACTION.DEVTOOLS;
    udid: string;
}
