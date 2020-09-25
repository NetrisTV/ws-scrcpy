import { Message } from './Message';

export interface MessageRunWda extends Message {
    type: 'run-wda';
    data: {
        udid: string;
        code: number;
        text: string;
    };
}
