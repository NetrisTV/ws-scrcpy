import { ManagerClient } from './ManagerClient';
import { ControlMessage } from '../controlMessage/ControlMessage';
import DeviceMessage from '../DeviceMessage';
import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Util from '../Util';

const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC_BYTES_INITIAL = Util.stringToUtf8ByteArray('scrcpy_initial');
const MAGIC_BYTES_MESSAGE = Util.stringToUtf8ByteArray('scrcpy_message');
const CLIENT_ID_LENGTH = 2;
const CLIENTS_COUNT_LENGTH = 2;

type VideoParameters = {
    videoSettings: VideoSettings;
    screenInfo: ScreenInfo;
};

type ClientsStats = {
    deviceName: string;
    clientId: number;
    clientsCount: number;
};

interface StreamReceiverEvents {
    video: ArrayBuffer;
    deviceMessage: DeviceMessage;
    videoParameters: VideoParameters;
    clientsStats: ClientsStats;
    encoders: string[];
    connected: void;
    disconnected: CloseEvent;
}

interface InitialInfo {
    videoParameters: VideoParameters;
    encoders: string[];
    clientsStats: ClientsStats;
}

export class StreamReceiver extends ManagerClient<StreamReceiverEvents> {
    private events: ControlMessage[] = [];
    private encoders: Set<string> = new Set<string>();
    private initialInfo?: InitialInfo;

    constructor(
        private readonly host: string,
        private readonly port: number | string,
        private readonly path = '/',
        private readonly query = '',
    ) {
        super();
        this.openNewWebSocket();
        (this.ws as WebSocket).binaryType = 'arraybuffer';
    }

    private handleInitialInfo(data: ArrayBuffer): void {
        let offset = MAGIC_BYTES_INITIAL.length;
        let nameBytes = new Uint8Array(data, offset, DEVICE_NAME_FIELD_LENGTH);
        nameBytes = Util.filterTrailingZeroes(nameBytes);
        const deviceName = Util.utf8ByteArrayToString(nameBytes);
        offset += DEVICE_NAME_FIELD_LENGTH;
        let temp = new Buffer(new Uint8Array(data, offset, ScreenInfo.BUFFER_LENGTH));
        offset += ScreenInfo.BUFFER_LENGTH;
        const screenInfo = ScreenInfo.fromBuffer(temp);
        temp = new Buffer(new Uint8Array(data, offset));
        const videoSettings = VideoSettings.fromBuffer(temp);
        offset += videoSettings.bytesLength;
        temp = new Buffer(new Uint8Array(data, offset, CLIENT_ID_LENGTH + CLIENTS_COUNT_LENGTH));
        const clientId = temp.readInt16BE(0);
        const clientsCount = temp.readInt16BE(CLIENT_ID_LENGTH);
        offset += CLIENT_ID_LENGTH + CLIENTS_COUNT_LENGTH;
        this.encoders.clear();
        if (data.byteLength > offset) {
            temp = new Buffer(new Uint8Array(data, offset));
            offset = 0;
            const encodersCount = temp.readInt32BE(offset);
            offset += 4;
            for (let i = 0; i < encodersCount; i++) {
                const nameLength = temp.readInt32BE(offset);
                offset += 4;
                const nameBytes = temp.slice(offset, offset + nameLength);
                offset += nameLength;
                const name = Util.utf8ByteArrayToString(nameBytes);
                this.encoders.add(name);
            }
        }
        const encoders = this.getEncoders();
        const videoParameters = { videoSettings, screenInfo };
        const clientsStats = {
            clientId: clientId,
            clientsCount: clientsCount,
            deviceName: deviceName,
        };
        this.initialInfo = {
            encoders,
            videoParameters,
            clientsStats,
        };
        this.triggerInitialInfoEvents();
    }

    private static EqualArrays(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0, l = a.length; i < l; i++) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }

    protected onSocketClose(ev: CloseEvent): void {
        console.log('WS closed');
        this.emit('disconnected', ev);
    }

    protected onSocketMessage(e: MessageEvent): void {
        if (e.data instanceof ArrayBuffer) {
            // works only because MAGIC_BYTES_INITIAL and MAGIC_BYTES_MESSAGE have same length
            if (e.data.byteLength > MAGIC_BYTES_INITIAL.length) {
                const magicBytes = new Uint8Array(e.data, 0, MAGIC_BYTES_INITIAL.length);
                if (StreamReceiver.EqualArrays(magicBytes, MAGIC_BYTES_INITIAL)) {
                    this.handleInitialInfo(e.data);
                    return;
                }
                if (StreamReceiver.EqualArrays(magicBytes, MAGIC_BYTES_MESSAGE)) {
                    const message = DeviceMessage.fromBuffer(e.data);
                    this.emit('deviceMessage', message);
                    return;
                }
            }

            this.emit('video', new Uint8Array(e.data));
        }
    }

    protected onSocketOpen(): void {
        this.emit('connected', void 0);
        let e = this.events.shift();
        while (e) {
            this.sendEvent(e);
            e = this.events.shift();
        }
    }

    public sendEvent(event: ControlMessage): void {
        if (this.hasConnection()) {
            (this.ws as WebSocket).send(event.toBuffer());
        } else {
            this.events.push(event);
        }
    }

    public stop(): void {
        if (this.hasConnection()) {
            (this.ws as WebSocket).close();
        }
        this.events.length = 0;
    }

    public getEncoders(): string[] {
        return Array.from(this.encoders.values());
    }

    public triggerInitialInfoEvents(): void {
        if (this.initialInfo) {
            const { encoders, videoParameters, clientsStats } = this.initialInfo;
            this.emit('encoders', encoders);
            this.emit('clientsStats', clientsStats);
            this.emit('videoParameters', videoParameters);
        }
    }

    protected buildWebSocketUrl(): string {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const query = this.query ? this.query : this.action ? `?action=${this.action}` : '';
        return `${proto}://${this.host}:${this.port}${this.path}${query}`;
    }
}
