import { Message } from './Message';
import { WdaStatus } from '../common/WdaStatus';

export interface MessageRunWdaResponse extends Message {
    type: 'run-wda';
    data: {
        udid: string;
        status: WdaStatus;
        code?: number;
        text?: string;
    };
}
