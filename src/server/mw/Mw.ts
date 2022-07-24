import { Message } from '../../types/Message';
import * as http from 'http';
import * as querystring from 'querystring';
import url from 'url';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';
import WS from 'ws';
import Protocol from '@devicefarmer/adbkit/lib/adb/protocol';

export type RequestParameters = {
    request: http.IncomingMessage;
    parsedUrl: url.UrlWithStringQuery;
    parsedQuery: querystring.ParsedUrlQuery;
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

    protected static sendError(message: string, channel: Multiplexer): void {
        if (channel.readyState === channel.OPEN) {
            const length = Buffer.byteLength(message, 'utf-8');
            const buf = Buffer.alloc(4 + 4 + length);
            let offset = buf.write(Protocol.FAIL, 'ascii');
            offset = buf.writeUInt32LE(length, offset);
            buf.write(message, offset, 'utf-8');
            channel.send(buf);
            channel.close();
        }
    }

    public release(): void {
        const { readyState, CLOSED, CLOSING } = this.ws;
        if (readyState !== CLOSED && readyState !== CLOSING) {
            this.ws.close();
        }
    }
}
