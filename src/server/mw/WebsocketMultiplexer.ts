import { Mw, MwFactory, RequestParameters } from './Mw';
import { ACTION } from '../../common/Action';
import { Multiplexer } from '../../packages/multiplexer/Multiplexer';
import WS from 'ws';
import Util from '../../app/Util';

export class WebsocketMultiplexer extends Mw {
    public static readonly TAG = 'WebsocketMultiplexer';
    private static mwFactories: Set<MwFactory> = new Set();
    private multiplexer: Multiplexer;
    // private mw: Set<Mw> = new Set();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public static processRequest(ws: WS, params: RequestParameters): WebsocketMultiplexer | undefined {
        const { action } = params;
        if (action !== ACTION.MULTIPLEX) {
            return;
        }
        return this.createMultiplexer(ws);
    }

    public static createMultiplexer(ws: WS): WebsocketMultiplexer {
        const service = new WebsocketMultiplexer(ws);
        service.init().catch((e) => {
            const msg = `[${this.TAG}] Failed to start service: ${e.message}`;
            console.error(msg);
            ws.close(4005, msg);
        });
        return service;
    }

    constructor(ws: WS) {
        super(ws);
        this.multiplexer = Multiplexer.wrap(ws as unknown as WebSocket);
    }

    public async init(): Promise<void> {
        this.multiplexer.addEventListener('channel', this.onChannel);
    }

    public static registerMw(mwFactory: MwFactory): void {
        this.mwFactories.add(mwFactory);
    }

    protected onSocketMessage(_event: WS.MessageEvent): void {
        // none;
    }

    protected onChannel({ channel, data }: { channel: Multiplexer; data: ArrayBuffer }): void {
        let processed = false;
        for (const mwFactory of WebsocketMultiplexer.mwFactories.values()) {
            try {
                const code = Util.utf8ByteArrayToString(Buffer.from(data).slice(0, 4));
                const buffer = data.byteLength > 4 ? data.slice(4) : undefined;
                const mw = mwFactory.processChannel(channel, code, buffer);
                if (mw) {
                    processed = true;
                    // this.mw.add(mw);
                    // const remove = () => {
                    //     this.mw.delete(mw);
                    // };
                    // channel.addEventListener('close', remove);
                    // channel.addEventListener('error', remove);
                }
            } finally {
            }
        }
        if (!processed) {
            channel.close(4002, `[${WebsocketMultiplexer.TAG}] Unsupported request`);
        }
    }

    public release(): void {
        super.release();
    }
}
