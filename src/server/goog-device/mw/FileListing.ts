import { Mw } from '../../mw/Mw';
import { AdbUtils } from '../AdbUtils';
import Util from '../../../app/Util';
import Protocol from '@dead50f7/adbkit/lib/adb/protocol';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';
import { FilePushReader } from '../filePush/FilePushReader';

export class FileListing extends Mw {
    public static readonly TAG = 'FileListing';
    protected name = 'FileListing';

    public static processChannel(ws: Multiplexer, code: string, data: ArrayBuffer): Mw | undefined {
        if (code !== ChannelCode.FSLS) {
            return;
        }
        if (!data || data.byteLength < 4) {
            return;
        }
        const buffer = Buffer.from(data);
        const length = buffer.readInt32LE(0);
        const serial = Util.utf8ByteArrayToString(buffer.slice(4, 4 + length));
        return new FileListing(ws, serial);
    }

    constructor(ws: Multiplexer, private readonly serial: string) {
        super(ws);
        ws.on('channel', (params) => {
            FileListing.handleNewChannel(this.serial, params.channel, params.data);
        });
    }

    protected sendMessage = (): void => {
        throw Error('Do not use this method. You must send data over channels');
    };

    protected onSocketMessage(): void {
        // Nothing here. All communication are performed over the channels. See `handleNewChannel` below.
    }

    private static handleNewChannel(serial: string, channel: Multiplexer, arrayBuffer: ArrayBuffer): void {
        const data = Buffer.from(arrayBuffer);
        if (data.length < 4) {
            console.error(`[${FileListing.TAG}]`, `Invalid message. Too short (${data.length})`);
            return;
        }
        let offset = 0;
        const cmd = Util.utf8ByteArrayToString(data.slice(offset, 4));
        offset += 4;
        switch (cmd) {
            case Protocol.LIST:
            case Protocol.STAT:
            case Protocol.RECV:
                const length = data.readUInt32LE(offset);
                offset += 4;
                const pathBuffer = data.slice(offset, offset + length);
                const pathString = Util.utf8ByteArrayToString(pathBuffer);
                FileListing.handle(cmd, serial, pathString, channel).catch((error: Error) => {
                    console.error(`[${FileListing.TAG}]`, error.message);
                });
                break;
            case Protocol.SEND:
                FilePushReader.handle(serial, channel);
                break;
            default:
                console.error(`[${FileListing.TAG}]`, `Invalid message. Wrong command (${cmd})`);
                channel.close(4001, `Invalid message. Wrong command (${cmd})`);
                break;
        }
    }

    private static async handle(cmd: string, serial: string, pathString: string, channel: Multiplexer): Promise<void> {
        try {
            if (cmd === Protocol.STAT) {
                return AdbUtils.pipeStatToStream(serial, pathString, channel);
            }
            if (cmd === Protocol.LIST) {
                return AdbUtils.pipeReadDirToStream(serial, pathString, channel);
            }
            if (cmd === Protocol.RECV) {
                return AdbUtils.pipePullFileToStream(serial, pathString, channel);
            }
        } catch (error: any) {
            FileListing.sendError(error?.message, channel);
        }
    }

    private static sendError(message: string, channel: Multiplexer): void {
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
}
