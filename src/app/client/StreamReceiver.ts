import { ManagerClient } from './ManagerClient';
import { ControlMessage } from '../controlMessage/ControlMessage';
import DeviceMessage from '../DeviceMessage';
import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Util from '../Util';

const DEVICE_NAME_FIELD_LENGTH = 64;
const MAGIC = 'scrcpy';
const MAGIC_BYTES = Util.stringToUtf8ByteArray(MAGIC);
const CLIENT_ID_LENGTH = 2;
const CLIENTS_COUNT_LENGTH = 2;
const DEVICE_INFO_LENGTH =
    MAGIC.length +
    DEVICE_NAME_FIELD_LENGTH +
    ScreenInfo.BUFFER_LENGTH +
    VideoSettings.BUFFER_LENGTH +
    CLIENT_ID_LENGTH +
    CLIENTS_COUNT_LENGTH;

interface StreamReceiverEvents {
    video: ArrayBuffer;
    deviceMessage: DeviceMessage;
    videoParameters: {
        videoSettings: VideoSettings;
        screenInfo: ScreenInfo;
    };
    clientsStats: {
        deviceName: string;
        clientId: number;
        clientsCount: number;
    };
}

export class StreamReceiver extends ManagerClient<StreamReceiverEvents> {
    private events: ControlMessage[] = [];

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

    private handleDeviceInfo(data: ArrayBuffer): void {
        let offset = MAGIC.length;
        let nameBytes = new Uint8Array(data, offset, DEVICE_NAME_FIELD_LENGTH);
        nameBytes = Util.filterTrailingZeroes(nameBytes);
        const deviceName = Util.utf8ByteArrayToString(nameBytes);
        offset += DEVICE_NAME_FIELD_LENGTH;
        let temp = new Buffer(new Uint8Array(data, offset, ScreenInfo.BUFFER_LENGTH));
        offset += ScreenInfo.BUFFER_LENGTH;
        const screenInfo = ScreenInfo.fromBuffer(temp);
        temp = new Buffer(new Uint8Array(data, offset, VideoSettings.BUFFER_LENGTH));
        const videoSettings = VideoSettings.fromBuffer(temp);
        this.emit('videoParameters', { videoSettings, screenInfo });
        offset += VideoSettings.BUFFER_LENGTH;
        temp = new Buffer(new Uint8Array(data, offset, CLIENT_ID_LENGTH + CLIENTS_COUNT_LENGTH));
        const clientId = temp.readInt16BE(0);
        const clientsCount = temp.readInt16BE(CLIENT_ID_LENGTH);
        this.emit('clientsStats', {
            clientId: clientId,
            clientsCount: clientsCount,
            deviceName: deviceName,
        });
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

    protected onSocketClose(): void {
        console.log('WS closed');
    }

    protected onSocketMessage(e: MessageEvent): void {
        if (e.data instanceof ArrayBuffer) {
            const data = new Uint8Array(e.data);
            const magicBytes = new Uint8Array(e.data, 0, MAGIC.length);
            if (StreamReceiver.EqualArrays(magicBytes, MAGIC_BYTES)) {
                if (data.length === DEVICE_INFO_LENGTH) {
                    this.handleDeviceInfo(e.data);
                    return;
                } else {
                    const message = DeviceMessage.fromBuffer(e.data);
                    this.emit('deviceMessage', message);
                }
            } else {
                this.emit('video', data);
            }
        }
    }

    protected onSocketOpen(): void {
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

    protected buildWebSocketUrl(): string {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const query = this.query ? this.query : this.action ? `?action=${this.action}` : '';
        return `${proto}://${this.host}:${this.port}${this.path}${query}`;
    }
}
