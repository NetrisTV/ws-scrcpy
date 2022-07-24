import WS from 'ws';
import { Mw } from '../../mw/Mw';
import { AdbUtils } from '../AdbUtils';
import Util from '../../../app/Util';
import Protocol from '@devicefarmer/adbkit/lib/adb/protocol';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';
import TcpUsbServer from '@devicefarmer/adbkit/lib/adb/tcpusb/server';

export class ConnectionForward extends Mw {
    public static readonly TAG = 'ConnectionForward';

    public static processChannel(ws: Multiplexer, code: string, data: ArrayBuffer): Mw | undefined {
        if (code !== ChannelCode.USBF) {
            return;
        }
        if (!data || data.byteLength < 4) {
            return;
        }
        const buffer = Buffer.from(data);
        const length = buffer.readInt32LE(0);
        const serial = Util.utf8ByteArrayToString(buffer.slice(4, 4 + length));
        return new ConnectionForward(ws, serial);
    }

    private server?: TcpUsbServer;

    constructor(private readonly channel: Multiplexer, private readonly serial: string) {
        super(channel);
        this.name = `[${ConnectionForward.TAG}|${serial}]`;
        this.initServer();
    }

    protected onSocketClose(): void {
        super.onSocketClose();
        if (this.server) {
            this.server.end();
            this.server = undefined;
        }
    }

    protected sendMessage = (): void => {
        throw Error('Do not use this method. You must send data over channels');
    };

    protected onSocketMessage(event: WS.MessageEvent): void {
        console.log(this.name, 'onSocketMessage', event.data);
    }

    protected async initServer(): Promise<void> {
        const maxWaitTime = 20000;
        try {
            const { server, port } = await AdbUtils.createTcpUsbBridge(this.serial, maxWaitTime);
            this.server = server;
            server.on('connection', () => {
                console.log(this.name, 'Has connection');
            });
            ConnectionForward.sendPort(port, this.channel);
        } catch (e) {
            ConnectionForward.sendError(e.message, this.channel);
        }
    }

    private static sendPort(port: number, channel: Multiplexer): void {
        if (channel.readyState === channel.OPEN) {
            const buf = Buffer.alloc(4 + 2);
            const offset = buf.write(Protocol.DATA, 'ascii');
            buf.writeUInt16LE(port, offset);
            channel.send(buf);
            channel.close();
        }
    }
}
