import { Message } from '../../types/Message';
import * as http from 'http';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';
import WS from 'ws';

export type RequestParameters = {
    request: http.IncomingMessage;
    url: URL;
    action: string;
};

export interface MwFactory {
    processRequest(ws: WS, params: RequestParameters): Mw | undefined;
    processChannel(ws: Multiplexer, code: string, data?: ArrayBuffer): Mw | undefined;
}

export abstract class Mw {
    protected name = 'Mw';

    public static processChannel(_ws: Multiplexer, _code: string, _data?: ArrayBuffer): Mw | undefined {
        return;
    }

    public static processRequest(_ws: WS, _params: RequestParameters): Mw | undefined {
        return;
    }

    protected constructor(protected readonly ws: WS | Multiplexer) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.ws.addEventListener('message', this.onSocketMessage.bind(this));
        this.ws.addEventListener('close', this.onSocketClose.bind(this));
    }

    protected abstract onSocketMessage(event: WS.MessageEvent): void;

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
        const { readyState, CLOSED, CLOSING } = this.ws;
        if (readyState !== CLOSED && readyState !== CLOSING) {
            this.ws.close();
        }
    }
}
