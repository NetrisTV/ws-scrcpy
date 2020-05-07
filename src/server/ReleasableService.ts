import { Message } from '../common/Message';
import WebSocket from 'ws';

export abstract class ReleasableService {
    protected constructor(protected readonly ws: WebSocket) {
        this.ws.onmessage = this.onSocketMessage.bind(this);
        this.ws.onclose = this.onSocketClose.bind(this);
    }

    protected abstract onSocketMessage(event: WebSocket.MessageEvent): void;

    protected sendMessage = (data: Message): void => {
        if (this.ws.readyState !== this.ws.OPEN) {
            return;
        }
        this.ws.send(JSON.stringify(data));
    };

    protected onSocketClose(): void {
        this.release();
    }

    public release(): void {
        delete this.ws.onmessage;
        this.ws.close();
    }
}
