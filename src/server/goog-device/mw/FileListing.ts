import WS from 'ws';
import { Mw } from '../../mw/Mw';
import Stats from '@devicefarmer/adbkit/lib/adb/sync/stats';
import { AdbUtils } from '../AdbUtils';
import Util from '../../../app/Util';
import Protocol from '@devicefarmer/adbkit/lib/adb/protocol';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { Message } from '../../../types/Message';
import { ChannelCode } from '../../../common/ChannelCode';

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
        const udid = Util.utf8ByteArrayToString(buffer.slice(4, 4 + length));
        return new FileListing(ws, udid);
    }

    constructor(ws: Multiplexer, private readonly udid: string) {
        super(ws);
        ws.on('channel', (params) => {
            FileListing.handleRequest(this.udid, params.channel, params.data);
        });
    }

    protected sendMessage = (_data: Message): void => {
        // if (this.ws.readyState !== this.ws.OPEN) {
        //     return;
        // }
        // this.ws.send(JSON.stringify(data));
    };

    private static handleRequest(udid: string, channel: Multiplexer, arrayBuffer: ArrayBuffer): void {
        const data = Buffer.from(arrayBuffer);
        if (data.length < 4) {
            console.error(`[${FileListing.TAG}]`, `Invalid message. Too short (${data.length})`);
            return;
        }
        let offset = 0;
        const cmd = Util.utf8ByteArrayToString(data.slice(offset, 4));
        offset += 4;
        if (cmd !== 'LIST') {
            console.error(`[${FileListing.TAG}]`, `Invalid message. Wrong command (${cmd})`);
            return;
        }
        const length = data.readUInt32LE(offset);
        offset += 4;
        const pathBuffer = data.slice(offset, offset + length);
        const path = Util.utf8ByteArrayToString(pathBuffer);
        FileListing.handleMessage(udid, path, channel).catch((e: Error) => {
            console.error(`[${FileListing.TAG}]`, e.message);
        });
    }

    protected onSocketMessage(_event: WS.MessageEvent): void {
        // this.handleRequest(Buffer.from(event.data));
    }

    private static async handleMessage(udid: string, entry: string, channel: Multiplexer): Promise<void> {
        let stats: Stats;
        try {
            stats = await AdbUtils.stats(udid, entry);
        } catch (e) {
            FileListing.sendError(e.message, channel);
            return;
        }
        if (stats.isDirectory()) {
            try {
                await AdbUtils.pipeReadDirToStream(udid, entry, channel);
            } catch (e) {
                FileListing.sendError(e.message, channel);
            }
        } else {
            try {
                await AdbUtils.pipePullFileToStream(udid, entry, channel);
            } catch (e) {
                FileListing.sendError(e.message, channel);
            }
        }
    }

    private static sendError(message: string, channel: Multiplexer): void {
        if (channel.readyState === channel.OPEN) {
            const length = Buffer.byteLength(message, 'utf-8');
            const buf = Buffer.alloc(4 + 4 + length);
            buf.write(Protocol.FAIL, 'ascii');
            buf.writeUInt32LE(length, 4);
            buf.write(message, 8, 'utf-8');
            channel.send(buf);
        }
    }
}
