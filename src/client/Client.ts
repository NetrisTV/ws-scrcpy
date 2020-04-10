export abstract class Client {
    public static ACTION: string = 'unknown';

    // tslint:disable-next-line:no-any
    public static start(..._rest: any[]): void {
        throw Error('Not implemented');
    }

    protected ws: WebSocket;

    protected constructor(protected readonly action: string) {
        this.ws = this.openNewWebSocket();
    }

    protected setTitle(text: string): void {
        let titleTag: HTMLTitleElement | null = document.querySelector('head > title');
        if (!titleTag) {
            titleTag = document.createElement('title');
        }
        titleTag.innerText = text;
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
