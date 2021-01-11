import { ParsedUrlQueryInput } from 'querystring';
import { ACTION } from '../server/Constants';

export interface DevtoolsParams extends ParsedUrlQueryInput {
    action: ACTION.DEVTOOLS;
    udid: string;
}
