import net from 'net';
import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ACTION } from '../../../common/Action';
import { AdbUtils } from '../AdbUtils';
import { AdbExtended } from '../adb';
import { SCRCPY_SOCKET_NAME } from '../../../common/Constants';

// scrcpy 3.x frame header: 8 bytes (flags+PTS) + 4 bytes (packet_size)
const FRAME_HEADER_SIZE = 12;
const IS_CONFIG_FLAG = 0x80000000; // bit 31 of hi-u32 = bit 63 of the 8-byte flags field

// Magic prefixes used by StreamReceiver to dispatch packets
const MAGIC_BYTES_INITIAL = Buffer.from('scrcpy_initial');  // 14 bytes
// Audio packets are tagged so StreamReceiver can emit 'audio' events
// 15 bytes total to remain unique from other magics
const AUDIO_MAGIC = Buffer.from('scrcpy_audio\0\0\0'); // 15 bytes

// scrcpy 3.x video codec IDs (big-endian ASCII of codec name)
const CODEC_H264 = 0x68323634; // 'h264'
const CODEC_H265 = 0x68323635; // 'h265'
const CODEC_AV1  = 0x00617631; // '\0av1'

// scrcpy 3.x audio codec IDs
const CODEC_OPUS = 0x6f707573; // 'opus'
const CODEC_AAC  = 0x00616163; // '\0aac'

// Special audio codec sentinel values
const AUDIO_DISABLED = 0x00000000; // server was told audio=false, or device has no audio
const AUDIO_ERRORED  = 0x00000001; // audio initialisation failed on device

// scrcpy 3.x video socket handshake: [1 dummy][64 name][4 codec_id] then frames
// NOTE: unlike some earlier protocol docs suggest, scrcpy 3.x does NOT send width/height here.
const DEVICE_NAME_FIELD_LENGTH = 64;

const TAG = '[ScrcpyTcpProxy]';

export class ScrcpyTcpProxy extends Mw {
    public static readonly TAG = TAG;

    private released = false;
    private videoSocket?: net.Socket;
    private audioSocket?: net.Socket;
    private controlSocket?: net.Socket;
    private forwardedPort?: number;

    public static processRequest(ws: WS, params: RequestParameters): ScrcpyTcpProxy | undefined {
        const { action, url } = params;
        if (action !== ACTION.STREAM_SCRCPY_TCP) {
            return;
        }
        const udid = url.searchParams.get('udid');
        if (!udid) {
            ws.close(4003, `${TAG} Missing udid parameter`);
            return;
        }
        return new ScrcpyTcpProxy(ws, udid);
    }

    private constructor(ws: WS, private readonly udid: string) {
        super(ws);
        this.init().catch((e: Error) => {
            console.error(TAG, e.message);
            if (!this.released) {
                (ws as WS).close(4005, e.message);
            }
        });
    }

    // ─── Initialisation ──────────────────────────────────────────────────────

    private async init(): Promise<void> {
        // Query screen size via ADB (scrcpy 3.x does NOT send dimensions in the video handshake)
        const screenSize = await this.getScreenSize();

        // ADB-forward the scrcpy abstract socket to a local TCP port
        this.forwardedPort = await AdbUtils.forward(this.udid, `localabstract:${SCRCPY_SOCKET_NAME}`);
        const port = this.forwardedPort;

        // Open 3 sequential TCP connections as required by scrcpy 3.x with control=true:
        //   1. video  2. audio  3. control
        this.videoSocket = await this.connectTcp(port);
        this.audioSocket = await this.connectTcp(port);
        this.controlSocket = await this.connectTcp(port);

        // Control socket errors must NOT tear down the video/audio pipeline.
        // On some devices (e.g. Xiaomi), the first injected event throws a
        // SecurityException that kills scrcpy's Controller thread (and ultimately
        // the whole server process).  We log and clean up the control socket only;
        // the video/audio sockets will close naturally when the server exits.
        this.controlSocket.once('error', (e) => {
            console.warn(TAG, 'control socket error (controls disabled):', e.message);
            this.controlSocket?.destroy();
            this.controlSocket = undefined;
        });
        this.controlSocket.once('close', () => {
            this.controlSocket = undefined;
        });

        // Start audio piping in the background
        this.pipeAudio(this.audioSocket);

        // Video init: read scrcpy handshake, emit scrcpy_initial, then pipe frames
        await this.initVideo(this.videoSocket, screenSize);
    }

    private async getScreenSize(): Promise<{ width: number; height: number }> {
        try {
            const client = AdbExtended.createClient();
            const stream = await client.shell(this.udid, 'wm size');
            const output = await AdbExtended.util.readAll(stream);
            const match = output.toString().match(/Physical size:\s*(\d+)x(\d+)/);
            if (match) {
                return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
            }
        } catch (_) { /* fall through to default */ }
        return { width: 1080, height: 1920 };
    }

    // ─── TCP helpers ─────────────────────────────────────────────────────────

    private connectTcp(port: number): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection({ host: '127.0.0.1', port });
            socket.once('connect', () => resolve(socket));
            socket.once('error', reject);
        });
    }

    /** Read exactly `n` bytes from a socket, using the 'readable' event to avoid data loss. */
    private readExact(socket: net.Socket, n: number): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let received = 0;

            const tryRead = () => {
                while (received < n) {
                    const remaining = n - received;
                    const chunk = socket.read(remaining) as Buffer | null;
                    if (chunk === null) {
                        // Not enough data yet, wait for 'readable'
                        return;
                    }
                    chunks.push(chunk);
                    received += chunk.length;
                }
                // Got all n bytes
                socket.removeListener('readable', tryRead);
                socket.removeListener('error', onError);
                resolve(Buffer.concat(chunks, n));
            };

            const onError = (err: Error) => {
                socket.removeListener('readable', tryRead);
                reject(err);
            };

            socket.on('readable', tryRead);
            socket.once('error', onError);
            // Try immediately in case data is already buffered
            tryRead();
        });
    }

    /** Read one scrcpy frame (12-byte header + body). */
    private async readFrame(socket: net.Socket): Promise<{ isConfig: boolean; data: Buffer }> {
        const header = await this.readExact(socket, FRAME_HEADER_SIZE);
        const hiFlags = header.readUInt32BE(0);
        const isConfig = !!(hiFlags & IS_CONFIG_FLAG);
        const size = header.readUInt32BE(8);
        const data = await this.readExact(socket, size);
        return { isConfig, data };
    }

    // ─── Video pipeline ───────────────────────────────────────────────────────

    /**
     * Read the scrcpy 3.x video socket handshake:
     *
     *   [1  byte ] dummy byte (always 0x00, discard)
     *   [64 bytes] device name (null-padded UTF-8)
     *   [4  bytes] codec_id (uint32 BE)
     *   [4  bytes] initial video width (uint32 BE)
     *   [4  bytes] initial video height (uint32 BE)
     *   ...then a stream of frames, each with a 12-byte header
     */
    private async initVideo(
        socket: net.Socket,
        adbScreenSize: { width: number; height: number },
    ): Promise<void> {
        // 1. Discard 1-byte dummy (only sent on the video / first socket)
        await this.readExact(socket, 1);

        // 2. Read device name (64 bytes, null-padded UTF-8)
        const nameBuf = await this.readExact(socket, DEVICE_NAME_FIELD_LENGTH);
        const nullIdx = nameBuf.indexOf(0);
        const deviceName = nameBuf.slice(0, nullIdx === -1 ? DEVICE_NAME_FIELD_LENGTH : nullIdx).toString('utf8');
        // 3. Read video codec metadata: codec_id(4) + width(4) + height(4) = 12 bytes
        const videoMeta = await this.readExact(socket, 12);
        const codecId = videoMeta.readUInt32BE(0);
        const videoWidth = videoMeta.readUInt32BE(4);
        const videoHeight = videoMeta.readUInt32BE(8);
        if (codecId !== CODEC_H264 && codecId !== CODEC_H265 && codecId !== CODEC_AV1) {
            throw new Error(`Unsupported video codec: 0x${codecId.toString(16)}`);
        }
        const codecName = codecId === CODEC_H264 ? 'H264' : codecId === CODEC_H265 ? 'H265' : 'AV1';

        // Use server-reported dimensions, fall back to ADB query
        const screenSize = (videoWidth > 0 && videoHeight > 0)
            ? { width: videoWidth, height: videoHeight }
            : adbScreenSize;
        console.log(TAG, `${deviceName}: ${codecName} ${screenSize.width}x${screenSize.height}`);

        // 4. Read the codec config packet (SPS+PPS for H.264) — first frame in stream
        const configFrame = await this.readFrame(socket);

        // 5. Build and send the scrcpy_initial message expected by StreamReceiver
        const initial = this.buildInitialMessage(deviceName, screenSize);
        this.sendToClient(initial);

        // 6. Send the config frame as the first video payload
        this.sendToClient(configFrame.data);

        // 7. Pipe remaining video frames (strip 12-byte headers, send raw NALUs)
        this.streamFrames(socket, false);
    }

    /**
     * Build a binary message compatible with StreamReceiver.handleInitialInfo().
     * Format:
     *   [14 bytes magic] [64 bytes device name]
     *   [4 bytes displaysCount=1]
     *   [24 bytes DisplayInfo] [4 bytes connectionCount=0]
     *   [4 bytes screenInfoBytesCount=25] [25 bytes ScreenInfo]
     *   [4 bytes videoSettingsBytesCount=0]
     *   [4 bytes encodersCount=0]
     *   [4 bytes clientId=1]
     */
    private buildInitialMessage(
        deviceName: string,
        size: { width: number; height: number },
    ): Buffer {
        const nameBuf = Buffer.alloc(DEVICE_NAME_FIELD_LENGTH);
        Buffer.from(deviceName, 'utf8').copy(nameBuf);

        // DisplayInfo: displayId(4) width(4) height(4) rotation(4) layerStack(4) flags(4)
        const displayInfo = Buffer.alloc(24);
        displayInfo.writeInt32BE(0, 0);          // displayId = 0
        displayInfo.writeInt32BE(size.width, 4);
        displayInfo.writeInt32BE(size.height, 8);
        displayInfo.writeInt32BE(0, 12);         // rotation = 0
        displayInfo.writeInt32BE(0, 16);         // layerStack = 0
        displayInfo.writeInt32BE(0, 20);         // flags = 0

        // ScreenInfo: contentRect(left,top,right,bottom) + videoSize(w,h) + rotation(1 byte)
        // Total: 25 bytes — matches ScreenInfo.BUFFER_LENGTH
        // Required by most players (needScreenInfoBeforePlay() returns true)
        const screenInfo = Buffer.alloc(25);
        screenInfo.writeInt32BE(0, 0);              // contentRect.left = 0
        screenInfo.writeInt32BE(0, 4);              // contentRect.top = 0
        screenInfo.writeInt32BE(size.width, 8);     // contentRect.right = width
        screenInfo.writeInt32BE(size.height, 12);   // contentRect.bottom = height
        screenInfo.writeInt32BE(size.width, 16);    // videoSize.width
        screenInfo.writeInt32BE(size.height, 20);   // videoSize.height
        screenInfo.writeUInt8(0, 24);               // deviceRotation = 0

        const i32 = (n: number) => { const b = Buffer.alloc(4); b.writeInt32BE(n, 0); return b; };

        return Buffer.concat([
            MAGIC_BYTES_INITIAL,
            nameBuf,
            i32(1),           // displaysCount
            displayInfo,
            i32(0),           // connectionCount
            i32(25),          // screenInfoBytesCount
            screenInfo,       // ScreenInfo data
            i32(0),           // videoSettingsBytesCount
            i32(0),           // encodersCount
            i32(1),           // clientId
        ]);
    }

    /** Stream frames from `socket` to the browser WebSocket. */
    private streamFrames(socket: net.Socket, isAudio: boolean): void {
        // We use the raw 'data' event and accumulate a rolling buffer for efficiency
        let buf = Buffer.alloc(0);

        const onData = (chunk: Buffer) => {
            buf = Buffer.concat([buf, chunk]);

            while (buf.length >= FRAME_HEADER_SIZE) {
                const size = buf.readUInt32BE(8);
                const total = FRAME_HEADER_SIZE + size;
                if (buf.length < total) break;

                const isConfig = !!(buf.readUInt32BE(0) & IS_CONFIG_FLAG);
                const payload = buf.slice(FRAME_HEADER_SIZE, total);
                buf = buf.slice(total);

                if (isAudio) {
                    // Tag audio with magic so StreamReceiver can emit 'audio' event
                    // Byte after magic: 0x01 = config packet, 0x00 = data packet
                    const flag = Buffer.alloc(1);
                    flag[0] = isConfig ? 1 : 0;
                    this.sendToClient(Buffer.concat([AUDIO_MAGIC, flag, payload]));
                } else {
                    this.sendToClient(payload);
                }
            }
        };

        const streamType = isAudio ? 'audio' : 'video';
        socket.on('data', onData);
        socket.once('error', (e) => console.error(TAG, `${streamType} socket error:`, e.message));
        socket.once('close', () => {
            console.log(TAG, `${streamType} socket closed`);
            if (!this.released) {
                this.release();
            }
        });
    }

    // ─── Audio pipeline ───────────────────────────────────────────────────────

    /**
     * Read the scrcpy 3.x audio socket handshake:
     *
     *   [4 bytes] codec_id or status sentinel (uint32 BE)
     *             0x00000000 = audio disabled / not requested
     *             0x00000001 = audio initialisation failed on device
     *             0x6f707573 ('opus') = Opus codec
     *             0x00616163 ('\0aac') = AAC codec
     *   ...then a stream of frames, each with a 12-byte header
     *
     * No dummy byte on the audio socket.
     */
    private async pipeAudio(socket: net.Socket): Promise<void> {
        try {
            // Read 4-byte codec_id / status
            const codecIdBuf = await this.readExact(socket, 4);
            const codecId = codecIdBuf.readUInt32BE(0);

            if (codecId === AUDIO_DISABLED) {
                console.warn(TAG, 'audio disabled or not available on device');
                return;
            }
            if (codecId === AUDIO_ERRORED) {
                console.warn(TAG, 'audio failed to initialise on device');
                return;
            }
            if (codecId !== CODEC_OPUS && codecId !== CODEC_AAC) {
                console.warn(TAG, `Unexpected audio codec: 0x${codecId.toString(16)}, skipping audio`);
                return;
            }
            console.log(TAG, 'audio codec:', codecId === CODEC_OPUS ? 'OPUS' : 'AAC');
            this.streamFrames(socket, true);
        } catch (e: any) {
            console.error(TAG, 'audio init error:', e.message);
        }
    }

    // ─── Control pipeline ─────────────────────────────────────────────────────

    // ─── Message from browser ─────────────────────────────────────────────────

    protected onSocketMessage(event: WS.MessageEvent): void {
        if (!this.controlSocket || this.controlSocket.destroyed) return;

        let buf: Buffer;
        const { data } = event;
        if (data instanceof Buffer) {
            buf = data;
        } else if (data instanceof ArrayBuffer) {
            buf = Buffer.from(data);
        } else if (typeof data === 'string') {
            buf = Buffer.from(data);
        } else {
            return;
        }

        if (buf.length === 0) return;

        // Filter out ws-scrcpy custom message types that scrcpy v3.1 doesn't understand.
        // Valid scrcpy v3.1 types are 0–17. Custom types (101=video settings, 102=file push)
        // would cause a ControlProtocolException and kill the server.
        const msgType = buf[0];
        if (msgType > 17) return;

        this.controlSocket.write(buf);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private sendToClient(data: Buffer): void {
        const ws = this.ws as WS;
        if (ws.readyState === WS.OPEN) {
            ws.send(data);
        }
    }

    // ─── Cleanup ──────────────────────────────────────────────────────────────

    public release(): void {
        if (this.released) return;
        console.log(TAG, 'releasing (destroying TCP sockets + closing WS)');
        this.released = true;
        [this.videoSocket, this.audioSocket, this.controlSocket].forEach((s) => {
            s?.destroy();
        });
        super.release();
    }
}
