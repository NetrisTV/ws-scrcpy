import { TypedEmitter } from '../../common/TypedEmitter';
import { Message } from './Message';
import { MessageType } from './MessageType';
import { CloseEventClass } from './CloseEventClass';
import { ErrorEventClass } from './ErrorEventClass';
import { MessageEventClass } from './MessageEventClass';
import Util from '../../app/Util';

interface WebsocketChannelEvents extends WebSocketEventMap {
    channel: { channel: Multiplexer; data: ArrayBuffer };
    open: Event;
    close: CloseEvent;
    message: MessageEvent;
}

export interface WebsocketEventEmitter {
    dispatchEvent(event: Event): boolean;
    addEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        options?: boolean | EventListenerOptions,
    ): void;
}

export class Multiplexer extends TypedEmitter<WebsocketChannelEvents> implements WebSocket {
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    public binaryType: BinaryType = 'blob';
    public readyState: number;
    private channels: Map<number, { channel: Multiplexer; emitter: WebsocketEventEmitter }> = new Map();
    private nextId = 0;
    private maxId = 4294967296;
    private storage: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
    private readonly messageEmitter: WebsocketEventEmitter;
    private readonly onOpenHandler: (event: Event) => void;
    private readonly onCloseHandler: (e: CloseEvent) => void;
    private readonly onErrorHandler: (e: Event) => void;
    private readonly onMessageHandler: (event: MessageEvent) => void;

    public onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
    public onerror: ((this: WebSocket, ev: Event) => any) | null = null;
    public onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
    public onopen: ((this: WebSocket, ev: Event) => any) | null = null;
    public url = '';

    public constructor(public readonly ws: WebSocket, private id = 0, emitter?: WebsocketEventEmitter) {
        super();
        this.readyState = ws.readyState;
        if (this.id === 0) {
            ws.binaryType = 'arraybuffer';
        }
        this.messageEmitter = emitter || ws;

        this.onOpenHandler = (event: Event) => {
            this.readyState = this.ws.readyState;
            const ws = this.ws;
            if (ws instanceof Multiplexer) {
                this.storage.forEach((data) => ws.sendData(data));
            } else {
                this.storage.forEach((data) => ws.send(data));
            }
            this.storage.length = 0;
            this.dispatchEvent(event);
        };

        this.onCloseHandler = (e: CloseEvent) => {
            this.readyState = this.ws.readyState;
            this.dispatchEvent(e);
            this.channels.clear();
        };

        this.onErrorHandler = (e: Event) => {
            this.readyState = this.ws.readyState;
            this.dispatchEvent(e);
            this.channels.clear();
        };

        this.onMessageHandler = (event: MessageEvent) => {
            const { data } = event;
            const message = Message.parse(data);
            switch (message.type) {
                case MessageType.CreateChannel: {
                    const { channelId, data } = message;
                    if (this.nextId < channelId) {
                        this.nextId = channelId;
                    }
                    const emitter = new TypedEmitter<WebsocketChannelEvents>();
                    const channel = new Multiplexer(this, channelId, emitter);
                    this.channels.set(channelId, { channel, emitter });
                    this.emit('channel', { channel, data });
                    break;
                }
                case MessageType.RawStringData: {
                    const data = this.channels.get(message.channelId);
                    if (data) {
                        const { channel } = data;
                        const msg = new MessageEventClass('message', {
                            data: Util.utf8ByteArrayToString(Buffer.from(message.data)),
                            lastEventId: event.lastEventId,
                            origin: event.origin,
                            source: event.source,
                        });
                        channel.dispatchEvent(msg);
                    } else {
                        console.error(`Channel with id (${message.channelId}) not found`);
                    }
                    break;
                }
                case MessageType.RawBinaryData: {
                    const data = this.channels.get(message.channelId);
                    if (data) {
                        const { channel } = data;
                        const msg = new MessageEventClass('message', {
                            data: message.data,
                            lastEventId: event.lastEventId,
                            origin: event.origin,
                            source: event.source,
                        });
                        channel.dispatchEvent(msg);
                    } else {
                        console.error(`Channel with id (${message.channelId}) not found`);
                    }
                    break;
                }
                case MessageType.Data: {
                    const data = this.channels.get(message.channelId);
                    if (data) {
                        const { emitter } = data;
                        const msg = new MessageEventClass('message', {
                            data: message.data,
                            lastEventId: event.lastEventId,
                            origin: event.origin,
                            source: event.source,
                        });
                        emitter.dispatchEvent(msg);
                    } else {
                        console.error(`Channel with id (${message.channelId}) not found`);
                    }
                    break;
                }
                case MessageType.CloseChannel: {
                    const data = this.channels.get(message.channelId);
                    if (data) {
                        const { channel } = data;
                        this.channels.delete(message.channelId);
                        channel.readyState = channel.CLOSING;
                        try {
                            channel.dispatchEvent(message.toCloseEvent());
                        } finally {
                            channel.readyState = channel.CLOSED;
                        }
                    } else {
                        console.error(`Channel with id (${message.channelId}) not found`);
                    }
                    break;
                }
                default:
                    const error = new Error(`Unsupported message type: ${message.type}`);
                    this.dispatchEvent(new ErrorEventClass('error', { error }));
            }
        };

        ws.addEventListener('open', this.onOpenHandler);
        ws.addEventListener('error', this.onErrorHandler);
        ws.addEventListener('close', this.onCloseHandler);
        this.messageEmitter.addEventListener('message', this.onMessageHandler);

        this.on('close', () => {
            ws.removeEventListener('open', this.onOpenHandler);
            ws.removeEventListener('error', this.onErrorHandler);
            ws.removeEventListener('close', this.onCloseHandler);
            this.messageEmitter.removeEventListener('message', this.onMessageHandler);
        });
    }

    public get bufferedAmount(): number {
        return 0;
    }

    public get extensions(): string {
        return '';
    }

    public get protocol(): string {
        return '';
    }

    public close(code = 0, reason?: string): void {
        if (this.readyState === this.CLOSED || this.readyState === this.CLOSING) {
            return;
        }
        if (this.id) {
            this.readyState = this.CLOSING;

            try {
                const message = Message.fromCloseEvent(this.id, code, reason).toBuffer();
                if (this.ws instanceof Multiplexer) {
                    this.ws.sendData(message);
                } else {
                    this.ws.send(message);
                }
                this.emit('close', new CloseEventClass('close', { code, reason }));
            } finally {
                this.readyState = this.CLOSED;
            }
        } else {
            this.ws.close(code, reason);
        }
    }

    public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        const { readyState } = this.ws;
        if (readyState === this.ws.OPEN) {
            if (this.ws instanceof Multiplexer) {
                if (typeof data === 'string') {
                    this.ws.sendData(Message.createBuffer(MessageType.RawStringData, this.id, Buffer.from(data)));
                } else {
                    this.ws.sendData(Message.createBuffer(MessageType.RawBinaryData, this.id, Buffer.from(data)));
                }
            } else {
                this.ws.send(data);
            }
        } else if (readyState === this.ws.CONNECTING) {
            this.storage.push(data);
        } else {
            console.error('Incorrect socket state');
        }
    }

    public sendData(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        const { readyState } = this.ws;
        if (readyState === this.ws.OPEN) {
            if (this.ws instanceof Multiplexer) {
                this.ws.sendData(Message.createBuffer(MessageType.Data, this.id, Buffer.from(data)));
            } else {
                this.ws.send(data);
            }
        } else if (readyState === this.ws.CONNECTING) {
            this.storage.push(data);
        } else {
            console.error('Incorrect socket state');
        }
    }

    public createChannel(data: Buffer): Multiplexer {
        if (this.readyState === this.CLOSING || this.readyState === this.CLOSED) {
            throw Error('Incorrect socket state');
        }
        const id = this.getNextId();
        const emitter = new TypedEmitter<WebsocketChannelEvents>();
        const channel = new Multiplexer(this, id, emitter);
        this.channels.set(id, { channel, emitter });
        this.sendData(Message.createBuffer(MessageType.CreateChannel, id, data));
        if (this.readyState === this.OPEN) {
            setImmediate(() => {
                channel.dispatchEvent(new Event('open'));
            });
        }
        return channel;
    }

    private getNextId(): number {
        let hitTop = false;
        while (this.channels.has(++this.nextId)) {
            if (this.nextId === this.maxId) {
                if (hitTop) {
                    throw Error('No available id');
                }
                this.nextId = 0;
                hitTop = true;
            }
        }
        return this.nextId;
    }

    public dispatchEvent(event: Event): boolean {
        if (event.type === 'close' && typeof this.onclose === 'function') {
            Reflect.apply(this.onclose, this, [event]);
        }
        if (event.type === 'open' && typeof this.onopen === 'function') {
            Reflect.apply(this.onopen, this, [event]);
        }
        if (event.type === 'message' && typeof this.onmessage === 'function') {
            Reflect.apply(this.onmessage, this, [event]);
        }
        if (event.type === 'error' && typeof this.onerror === 'function') {
            Reflect.apply(this.onerror, this, [event]);
        }
        return super.dispatchEvent(event);
    }
}
