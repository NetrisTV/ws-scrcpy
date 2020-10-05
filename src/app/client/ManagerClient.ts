import { BaseClient } from './BaseClient';

export abstract class ManagerClient<T> extends BaseClient<T> {
    public static ACTION = 'unknown';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    public static start(..._rest: any[]): void {
        throw Error('Not implemented');
    }

    protected ws?: WebSocket;

    protected constructor(protected readonly action?: string) {
        super();
    }

    public hasConnection(): boolean {
        return !!(this.ws && this.ws.readyState === this.ws.OPEN);
    }

    protected openNewWebSocket(): WebSocket {
        if (this.hasConnection()) {
            (this.ws as WebSocket).close();
        }
        this.ws = new WebSocket(this.buildWebSocketUrl());
        this.ws.onopen = this.onSocketOpen.bind(this);
        this.ws.onmessage = this.onSocketMessage.bind(this);
        this.ws.onclose = this.onSocketClose.bind(this);
        return this.ws;
    }

    protected buildWebSocketUrl(): string {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const query = this.action ? `/?action=${this.action}` : '';
        return `${proto}://${location.host}${query}`;
    }

    protected abstract onSocketOpen(e: Event): void;
    protected abstract onSocketMessage(e: MessageEvent): void;
    protected abstract onSocketClose(e: CloseEvent): void;
}
