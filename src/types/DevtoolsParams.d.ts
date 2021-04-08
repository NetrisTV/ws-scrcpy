import { ParsedUrlQueryInput } from 'querystring';
import { ACTION } from '../common/Constants';

export interface DevtoolsParams extends ParsedUrlQueryInput {
    action: ACTION.DEVTOOLS;
    udid: string;
}
