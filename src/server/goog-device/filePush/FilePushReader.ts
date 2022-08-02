import { ReadableOptions } from 'stream';
import { CommandControlMessage, FilePushState } from '../../../app/controlMessage/CommandControlMessage';
import { FilePushResponseStatus } from '../../../app/googDevice/filePush/FilePushResponseStatus';
import PushTransfer from '@dead50f7/adbkit/lib/adb/sync/pushtransfer';
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
        const buffer = Buffer.alloc(3);
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
    private createStreamPromiseMap: Map<number, Promise<void>> = new Map();
    private disposed = false;

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
        this.channel.removeEventListener('message', this.onMessage);
        this.channel.removeEventListener('close', this.onClose);
        this.channel.close(4000 - code, message);
        this.release();
    }

    private onMessage = async (event: MessageEvent): Promise<void> => {
        const command = CommandControlMessage.pushFileCommandFromBuffer(Buffer.from(event.data));

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
                    const promise = this.createStream(chunk);
                    this.createStreamPromiseMap.set(id, promise);
                    await promise;
                    this.createStreamPromiseMap.delete(id);
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
                const promise = this.createStreamPromiseMap.get(id);
                if (promise) {
                    await promise;
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
                }
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
        client.on('error', (error: Error) => {
            console.error(`Client error (${this.serial} | ${this.fileName}):`, error.message);
            this.closeWithError(FilePushResponseStatus.ERROR_OTHER, error.message);
        });
        this.pushTransfer.on('error', this.onPushError);
        this.pushTransfer.on('end', this.onPushEnd);
        this.pushTransfer.on('cancel', this.onPushCancel);
    }

    private onClose = (): void => {
        this.release();
    };

    private onPushError = (error: Error) => {
        this.closeWithError(FilePushResponseStatus.ERROR_OTHER, error.message);
    };

    private onPushEnd = () => {
        if (this.state === State.FINISH) {
            this.sendResponse(FilePushResponseStatus.NO_ERROR);
            this.release();
        } else {
            this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
        }
    };

    private onPushCancel = () => {
        if (this.state === State.CANCEL) {
            this.sendResponse(FilePushResponseStatus.NO_ERROR);
            this.release();
        } else {
            this.closeWithError(FilePushResponseStatus.ERROR_INVALID_STATE);
        }
    };

    public release(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.createStreamPromiseMap.clear();
        if (this.readStream) {
            this.readStream.close();
            this.readStream = undefined;
        }
        if (this.pushTransfer) {
            this.pushTransfer.off('error', this.onPushError);
            this.pushTransfer.off('end', this.onPushEnd);
            this.pushTransfer.off('cancel', this.onPushCancel);
            this.pushTransfer = undefined;
        }
        this.channel.removeEventListener('message', this.onMessage);
        this.channel.removeEventListener('close', this.onClose);
        const { readyState, CLOSED, CLOSING } = this.channel;
        if (readyState !== CLOSED && readyState !== CLOSING) {
            this.channel.close();
        }
    }
}
