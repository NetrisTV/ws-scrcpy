import { DragAndDropHandler, DragEventListener } from './DragAndDropHandler';
import DeviceMessage from './DeviceMessage';
import { CommandControlMessage, FilePushState } from '../controlMessage/CommandControlMessage';
import { StreamReceiverScrcpy } from './client/StreamReceiverScrcpy';

const ALLOWED_TYPES = ['application/vnd.android.package-archive'];

type Resolve = (result: number) => void;

export type PushUpdateParams = { pushId: number; logString: string; fileName: string; error: boolean };

export interface DragAndPushListener {
    onDragEnter: () => void;
    onDragLeave: () => void;
    onDrop: () => void;
    onFilePushUpdate: (data: PushUpdateParams) => void;
    onError: (error: Error | string) => void;
}

const TAG = '[FilePushHandler]';

export default class FilePushHandler implements DragEventListener {
    public static readonly REQUEST_NEW_PUSH_ID = 0; // ignored on server, when state is `NEW_PUSH_ID`
    public static readonly NEW_PUSH_ID: number = 1;
    public static readonly NO_ERROR: number = 0;
    public static readonly ERROR_INVALID_NAME: number = -1;
    public static readonly ERROR_NO_SPACE: number = -2;
    public static readonly ERROR_FAILED_TO_DELETE: number = -3;
    public static readonly ERROR_FAILED_TO_CREATE: number = -4;
    public static readonly ERROR_FILE_NOT_FOUND: number = -5;
    public static readonly ERROR_FAILED_TO_WRITE: number = -6;
    public static readonly ERROR_FILE_IS_BUSY: number = -7;
    public static readonly ERROR_INVALID_STATE: number = -8;
    public static readonly ERROR_UNKNOWN_ID: number = -9;
    public static readonly ERROR_NO_FREE_ID: number = -10;
    public static readonly ERROR_INCORRECT_SIZE: number = -11;

    private responseWaiter: Map<number, Resolve | Resolve[]> = new Map();
    private listeners: Set<DragAndPushListener> = new Set();

    constructor(private readonly element: HTMLElement, private readonly streamReceiver: StreamReceiverScrcpy) {
        DragAndDropHandler.addEventListener(this);
        streamReceiver.on('deviceMessage', this.onDeviceMessage);
    }

    private sendUpdate(params: PushUpdateParams): void {
        this.listeners.forEach((listener) => {
            listener.onFilePushUpdate(params);
        });
    }

    private logError(pushId: number, fileName: string, code: number): void {
        const msg = RESPONSE_CODES.get(code) || 'Unknown error';
        this.sendUpdate({ pushId, fileName, logString: `error: "${msg}"`, error: true });
    }

    private async pushFile(file: File): Promise<void> {
        const start = Date.now();
        const { name: fileName, size: fileSize } = file;
        if (!this.streamReceiver.hasConnection()) {
            this.listeners.forEach((listener) => {
                listener.onError('WebSocket is not ready');
            });
            return;
        }
        const id = FilePushHandler.REQUEST_NEW_PUSH_ID;
        this.sendUpdate({ pushId: id, fileName, logString: 'begin...', error: false });
        const newParams = { id, state: FilePushState.NEW };
        this.streamReceiver.sendEvent(CommandControlMessage.createPushFileCommand(newParams));
        const pushId: number = await this.waitForResponse(id);
        if (pushId <= 0) {
            this.logError(pushId, fileName, pushId);
        }

        const startParams = { id: pushId, fileName, fileSize, state: FilePushState.START };
        this.streamReceiver.sendEvent(CommandControlMessage.createPushFileCommand(startParams));
        const stream = file.stream();
        const reader = stream.getReader();
        const [startResponseCode, result] = await Promise.all([this.waitForResponse(pushId), reader.read()]);
        if (startResponseCode !== 0) {
            this.logError(pushId, fileName, startResponseCode);
            return;
        }
        let receivedBytes = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processData = async ({ done, value }: { done: boolean; value?: any }): Promise<void> => {
            if (done) {
                const finishParams = { id: pushId, state: FilePushState.FINISH };
                this.streamReceiver.sendEvent(CommandControlMessage.createPushFileCommand(finishParams));
                const finishResponseCode = await this.waitForResponse(pushId);
                if (finishResponseCode !== 0) {
                    this.logError(pushId, fileName, finishResponseCode);
                } else {
                    this.sendUpdate({ pushId, fileName, logString: 'success!', error: false });
                }
                console.log(TAG, `File "${fileName}" uploaded in ${Date.now() - start}ms`);
                return;
            }

            receivedBytes += value.length;
            const appendParams = { id: pushId, chunk: value, state: FilePushState.APPEND };
            this.streamReceiver.sendEvent(CommandControlMessage.createPushFileCommand(appendParams));

            const [appendResponseCode, result] = await Promise.all([this.waitForResponse(pushId), reader.read()]);
            if (appendResponseCode !== 0) {
                this.logError(pushId, fileName, appendResponseCode);
                return;
            }
            const percent = (receivedBytes * 100) / fileSize;
            this.sendUpdate({ pushId, fileName, logString: `${percent.toFixed(2)}%`, error: false });
            return processData(result);
        };
        return processData(result);
    }

    private waitForResponse(pushId: number): Promise<number> {
        return new Promise((resolve) => {
            const stored = this.responseWaiter.get(pushId);
            if (Array.isArray(stored)) {
                stored.push(resolve);
            } else if (stored) {
                const arr: Resolve[] = [stored];
                arr.push(resolve);
                this.responseWaiter.set(pushId, arr);
            } else {
                this.responseWaiter.set(pushId, resolve);
            }
        });
    }

    onDeviceMessage = (ev: DeviceMessage): void => {
        if (ev.type !== DeviceMessage.TYPE_PUSH_RESPONSE) {
            return;
        }
        let func: Resolve;
        let value: number;
        const stats = ev.getPushStats();
        const result = stats.result;
        const id = result === FilePushHandler.NEW_PUSH_ID ? FilePushHandler.REQUEST_NEW_PUSH_ID : stats.id;
        const idInResponse = stats.id;
        const resolve = this.responseWaiter.get(id);
        if (!resolve) {
            console.warn(`Unexpected push id: "${id}", ${JSON.stringify(stats)}`);
            return;
        }
        if (Array.isArray(resolve)) {
            func = resolve.shift() as Resolve;
            if (!resolve.length) {
                this.responseWaiter.delete(id);
            }
        } else {
            func = resolve;
            this.responseWaiter.delete(id);
        }
        if (result === FilePushHandler.NEW_PUSH_ID) {
            value = idInResponse;
        } else {
            value = result;
        }
        func(value);
    };
    public onFilesDrop(files: File[]): void {
        this.listeners.forEach((listener) => {
            listener.onDrop();
        });
        files.forEach((file: File) => {
            const { type, name } = file;
            if (ALLOWED_TYPES.includes(type)) {
                this.pushFile(file);
            } else {
                const errorParams = {
                    pushId: FilePushHandler.REQUEST_NEW_PUSH_ID,
                    fileName: name,
                    logString: `Unsupported type "${type}"`,
                    error: true,
                };
                this.sendUpdate(errorParams);
            }
        });
    }
    public onDragEnter(): void {
        this.listeners.forEach((listener) => {
            listener.onDragEnter();
        });
    }
    public onDragLeave(): void {
        this.listeners.forEach((listener) => {
            listener.onDragLeave();
        });
    }
    public getElement(): HTMLElement {
        return this.element;
    }
    public release(): void {
        DragAndDropHandler.removeEventListener(this);
        this.listeners.clear();
    }

    public addEventListener(listener: DragAndPushListener): void {
        this.listeners.add(listener);
    }
    public removeEventListener(listener: DragAndPushListener): void {
        this.listeners.delete(listener);
    }
}

const RESPONSE_CODES = new Map([
    [FilePushHandler.NEW_PUSH_ID, 'New push id'],
    [FilePushHandler.NO_ERROR, 'No error'],

    [FilePushHandler.ERROR_INVALID_NAME, 'Invalid name'],
    [FilePushHandler.ERROR_NO_SPACE, 'No space'],
    [FilePushHandler.ERROR_FAILED_TO_DELETE, 'Failed to delete existing'],
    [FilePushHandler.ERROR_FAILED_TO_CREATE, 'Failed to create new file'],
    [FilePushHandler.ERROR_FILE_NOT_FOUND, 'File not found'],
    [FilePushHandler.ERROR_FAILED_TO_WRITE, 'Failed to write to file'],
    [FilePushHandler.ERROR_FILE_IS_BUSY, 'File is busy'],
    [FilePushHandler.ERROR_INVALID_STATE, 'Invalid state'],
    [FilePushHandler.ERROR_UNKNOWN_ID, 'Unknown id'],
    [FilePushHandler.ERROR_NO_FREE_ID, 'No free id'],
    [FilePushHandler.ERROR_INCORRECT_SIZE, 'Incorrect size'],
]);
