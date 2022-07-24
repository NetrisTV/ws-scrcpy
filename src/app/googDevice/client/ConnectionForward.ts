import { ManagerClient } from '../../client/ManagerClient';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import Util from '../../Util';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import { ChannelCode } from '../../../common/ChannelCode';
import Protocol from '@devicefarmer/adbkit/lib/adb/protocol';

const TAG = '[ConnectionForward]';

export class ConnectionForward extends ManagerClient<ParamsDeviceTracker, never> {
    public static start(params: ParamsDeviceTracker, descriptor: GoogDeviceDescriptor): ConnectionForward {
        return new ConnectionForward(params, descriptor);
    }

    public static createEntryForDeviceList(
        descriptor: GoogDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): HTMLElement | DocumentFragment | undefined {
        if (descriptor.state !== 'device') {
            return;
        }
        const entry = document.createElement('div');
        entry.classList.add('connection-forward', blockClass);
        const button = document.createElement('button');
        button.innerText = `Forward`;
        button.classList.add('active', 'action-button');
        entry.appendChild(button);
        button.addEventListener('click', (e) => {
            e.preventDefault();
            ConnectionForward.start(params, descriptor);
        });
        return entry;
    }

    private readonly serial: string;

    constructor(params: ParamsDeviceTracker, descriptor: GoogDeviceDescriptor) {
        super(params);
        this.serial = descriptor.udid;
        this.openNewConnection();
        if (!this.ws) {
            throw Error('No WebSocket');
        }
    }

    protected onPortReceived(port: number): void {
        console.log(TAG, port);
    }

    protected onErrorReceived(message: string): void {
        console.error(TAG, message);
    }

    protected supportMultiplexing(): boolean {
        return true;
    }

    protected onSocketOpen = (): void => {
        console.log(TAG, `Connection open`);
    };

    protected onSocketClose(e: CloseEvent): void {
        console.log(TAG, `Connection closed: ${e.reason}`);
    }

    protected onSocketMessage(e: MessageEvent): void {
        const data = Buffer.from(e.data);
        const reply = data.slice(0, 4).toString('ascii');
        switch (reply) {
            case Protocol.DATA:
                const port = data.readUInt16LE(4);
                this.onPortReceived(port);
                break;
            case Protocol.FAIL:
                const length = data.readUInt32LE(4);
                const message = Util.utf8ByteArrayToString(data.slice(8, 8 + length));
                this.onErrorReceived(message);
                break;
            default:
                console.error(`Unexpected "${reply}"`);
        }
    }

    protected getChannelInitData(): Buffer {
        const serial = Util.stringToUtf8ByteArray(this.serial);
        const buffer = Buffer.alloc(4 + 4 + serial.byteLength);
        buffer.write(ChannelCode.USBF, 'ascii');
        buffer.writeUInt32LE(serial.length, 4);
        buffer.set(serial, 8);
        return buffer;
    }
}
