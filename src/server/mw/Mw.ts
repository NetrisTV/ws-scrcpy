import { Message } from '../../types/Message';
import WebSocket from 'ws';
import * as http from 'http';
import * as querystring from 'querystring';
import url from 'url';

export type RequestParameters = {
    request: http.IncomingMessage;
    parsedUrl: url.UrlWithStringQuery;
    parsedQuery: querystring.ParsedUrlQuery;
};

export interface MwFactory {
    processRequest(ws: WebSocket, params: RequestParameters): Mw | undefined;
}

export abstract class Mw {
    protected name = 'Mw';
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
