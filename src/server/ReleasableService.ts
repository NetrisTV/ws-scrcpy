import { Message } from '../common/Message';
import WebSocket from 'ws';

export abstract class ReleasableService {
    protected constructor(protected readonly ws: WebSocket) {
        this.ws.onmessage = this.onSocketMessage.bind(this);
    }

    protected abstract onSocketMessage(event: WebSocket.MessageEvent): void;

    protected sendMessage = (data: Message): void => {
        if (this.ws.readyState !== this.ws.OPEN) {
            return;
        }
        this.ws.send(JSON.stringify(data));
    };

    public release(): void {
        delete this.ws.onmessage;
    }
}
