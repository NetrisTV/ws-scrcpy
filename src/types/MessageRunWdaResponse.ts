import { Message } from './Message';

export interface MessageRunWdaResponse extends Message {
    type: 'run-wda';
    data: {
        udid: string;
        code: number;
        text?: string;
    };
}
