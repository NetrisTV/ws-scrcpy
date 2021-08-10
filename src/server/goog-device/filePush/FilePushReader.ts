import { ReadableOptions } from 'stream';
import { CommandControlMessage, FilePushState } from '../../../app/controlMessage/CommandControlMessage';
import { FilePushResponseStatus } from '../../../app/googDevice/filePush/FilePushResponseStatus';
import PushTransfer from '@devicefarmer/adbkit/lib/adb/sync/pushtransfer';
import { ReadStream } from './ReadStream';
import { AdbExtended } from '../adb';

enum State {
    INITIAL,
    NEW,
    START,
    APPEND,
    FINISH,
    CANCEL,
}

export class FilePushReader {
    private static fileId = 1;
    private static maxId = 4294967295; // 2^32 - 1

    public static handle(serial: string, channel: WebSocket): FilePushReader {
        return new FilePushReader(serial, channel);
    }

    public static getNextId(): number {
        this.fileId++;
        if (this.fileId > this.maxId) {
            this.fileId = 1;
        }
        return this.fileId;
    }

    private static createResponse(id: number, code: number): Buffer {
        const buffer = new Buffer(3);
        let offset = 0;
        offset = buffer.writeInt16BE(id, offset);
        buffer.writeInt8(code, offset);
        return buffer;
    }

    public readStream?: ReadStream;
    private pushTransfer?: PushTransfer;
    private fileName = '';
    private fileSize = 0;
    private pushId = -1;
    private state: State = State.INITIAL;

    constructor(private readonly serial: string, private readonly channel: WebSocket) {
        channel.addEventListener('message', this.onMessage);
        channel.addEventListener('close', this.onClose);
    }

    private verifyId(id: number): boolean {
        if (id !== this.pushId) {
            this.closeWithError(FilePushResponseStatus.ERROR_UNKNOWN_ID);
            return false;
        }
        return true;
    }

    private sendResponse(status: FilePushResponseStatus): void {
        if (this.channel.readyState === this.channel.CLOSING || this.channel.readyState === this.channel.CLOSED) {
            return;
        }
        this.channel.send(FilePushReader.createResponse(this.pushId, status));
    }

    private closeWithError(code: number, message?: string): void {
        this.channel.close(4000 - code, message);
    }

    private onMessage = async (e: MessageEvent): Promise<void> => {
        const command = CommandControlMessage.pushFileCommandFromBuffer(new Buffer(e.data));

        const { id, state } = command;
        switch (state) {
            case FilePushState.NEW:
                if (this.state !== State.INITIAL) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
                    return;
                }
                this.state = State.NEW;
                this.pushId = FilePushReader.getNextId();
                this.sendResponse(FilePushResponseStatus.NEW_PUSH_ID);
                break;
            case FilePushState.START:
                if (!this.verifyId(id)) {
                    return;
                }
                if (this.state !== State.NEW) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
                    return;
                }
                const { fileName, fileSize } = command;
                if (!fileName) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INVALID_NAME);
                    return;
                }
                if (!fileSize) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INCORRECT_SIZE);
                    return;
                }
                this.fileName = fileName;
                this.fileSize = fileSize;
                this.state = State.START;
                this.sendResponse(FilePushResponseStatus.NO_ERROR);
                break;
            case FilePushState.APPEND:
                if (!this.verifyId(id)) {
                    return;
                }
                const { chunk } = command;
                if (!chunk || !chunk.length) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INCORRECT_SIZE);
                    return;
                }
                if (this.state === State.START) {
                    await this.createStream(chunk);
                    this.state = State.APPEND;
                    return;
                } else if (this.state !== State.APPEND) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
                    return;
                }
                this.readStream?.push(chunk);
                break;
            case FilePushState.FINISH:
                if (!this.verifyId(id)) {
                    return;
                }
                if (this.state !== State.APPEND) {
                    this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
                    return;
                }
                this.state = State.FINISH;
                if (this.readStream) {
                    this.readStream.push(null);
                    this.readStream.close();
                    this.readStream = undefined;
                }
                if (this.pushTransfer) {
                    this.pushTransfer = undefined;
                }
                this.sendResponse(FilePushResponseStatus.NO_ERROR);
                this.release();
                break;
            case FilePushState.CANCEL:
                if (!this.verifyId(id)) {
                    return;
                }
                this.state = State.CANCEL;
                if (this.readStream) {
                    this.readStream.push(null);
                    this.readStream.close();
                    this.readStream = undefined;
                }
                if (this.pushTransfer) {
                    this.pushTransfer.cancel();
                    this.pushTransfer = undefined;
                }
                this.sendResponse(FilePushResponseStatus.NO_ERROR);
                this.release();
                break;
            default:
                if (!this.verifyId(id)) {
                    return;
                }
                this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
        }
    };

    private async createStream(chunk: Buffer): Promise<void> {
        const opts = {
            construct: (callback: (error?: Error | null) => void) => {
                callback(null);
            },
            read: () => {
                if (!this.readStream) {
                    return;
                }
                if (this.readStream.bytesRead > this.fileSize) {
                    console.error(`bytesRead (${this.readStream.bytesRead}) > fileSize (${this.fileSize})`);
                }
                this.sendResponse(FilePushResponseStatus.NO_ERROR);
            },
        } as ReadableOptions; // FIXME: incorrect type in @type/node@12. fixed in @type/node@16
        this.readStream = new ReadStream(this.fileName, opts);
        this.readStream.push(chunk);
        const client = AdbExtended.createClient();
        this.pushTransfer = await client.push(this.serial, this.readStream, this.fileName);
        client.on('error', (e: Error) => {
            console.error(`Client error (${this.serial} | ${this.fileName}):`, e.message);
            this.closeWithError(FilePushResponseStatus.ERROR_OTHER, e.message);
        });
        this.pushTransfer.on('error', (e: Error) => {
            console.error(`PushTransfer error (${this.serial} | ${this.fileName}):`, e.message);
            this.closeWithError(FilePushResponseStatus.ERROR_OTHER, e.message);
        });
    }

    private onClose = (): void => {
        if (this.readStream) {
            this.readStream.close();
            this.readStream = undefined;
        }
        if (this.pushTransfer) {
            this.pushTransfer = undefined;
        }
    };

    public release(): void {
        this.channel.close();
    }
}
