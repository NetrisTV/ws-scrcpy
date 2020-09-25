import { Message } from './Message';
import { XtermClientMessage } from './XtermMessage';

export interface MessageXtermClient extends Message {
    type: 'shell';
    data: XtermClientMessage;
}
