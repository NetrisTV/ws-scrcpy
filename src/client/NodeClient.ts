import { BaseClient } from './BaseClient';

export abstract class NodeClient extends BaseClient {
    public static ACTION: string = 'unknown';

    // tslint:disable-next-line:no-any
    public static start(..._rest: any[]): void {
        throw Error('Not implemented');
    }

    protected ws: WebSocket;

    protected constructor(protected readonly action: string) {
        super();
        this.ws = this.openNewWebSocket();
    }

    protected openNewWebSocket(): WebSocket {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.close();
        }
        this.ws = new WebSocket(`ws://${location.host}/?action=${this.action}`);
        this.ws.onmessage = this.onSocketMessage.bind(this);
        this.ws.onclose = this.onSocketClose.bind(this);
        return this.ws;
    }

    protected abstract onSocketMessage(e: MessageEvent): void;
    protected abstract onSocketClose(e: CloseEvent): void;
}
