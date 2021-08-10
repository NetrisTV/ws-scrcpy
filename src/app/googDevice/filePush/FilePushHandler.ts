import { DragAndDropHandler, DragEventListener } from '../DragAndDropHandler';
import { FilePushStream, PushResponse } from './FilePushStream';
import { FilePushResponseStatus } from './FilePushResponseStatus';

type Resolve = (response: PushResponse) => void;

export type PushUpdateParams = { pushId: number; logString: string; fileName: string; error: boolean };

export interface DragAndPushListener {
    onDragEnter: () => boolean;
    onDragLeave: () => boolean;
    onDrop: () => boolean;
    onFilePushUpdate: (data: PushUpdateParams) => void;
    onError: (error: Error | string) => void;
}

const TAG = '[FilePushHandler]';

export default class FilePushHandler implements DragEventListener {
    public static readonly REQUEST_NEW_PUSH_ID = 0; // ignored on server, when state is `NEW_PUSH_ID`

    private responseWaiter: Map<number, Resolve | Resolve[]> = new Map();
    private listeners: Set<DragAndPushListener> = new Set();

    constructor(private readonly element: HTMLElement, private readonly filePushStream: FilePushStream) {
        DragAndDropHandler.addEventListener(this);
        filePushStream.on('response', this.onStreamResponse);
        filePushStream.on('error', this.onStreamError);
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

    private static async getStreamReader(
        file: File,
    ): Promise<{ reader: ReadableStreamDefaultReader<Uint8Array>; result: ReadableStreamReadResult<Uint8Array> }> {
        const blob = await new Response(file).blob();
        const reader = blob.stream().getReader() as ReadableStreamDefaultReader<Uint8Array>;
        const result = await reader.read();
        return { reader, result };
    }

    private async pushFile(file: File): Promise<void> {
        const start = Date.now();
        const { name: fileName, size: fileSize } = file;
        if (!this.filePushStream.hasConnection()) {
            this.listeners.forEach((listener) => {
                listener.onError('WebSocket is not ready');
            });
            return;
        }
        const id = FilePushHandler.REQUEST_NEW_PUSH_ID;
        this.sendUpdate({ pushId: id, fileName, logString: 'begins...', error: false });
        this.filePushStream.sendEventNew({ id });
        const { code: pushId } = await this.waitForResponse(id);
        if (pushId <= 0) {
            this.logError(pushId, fileName, pushId);
        }

        const waitPromise = this.waitForResponse(pushId);
        this.filePushStream.sendEventStart({ id: pushId, fileName, fileSize });
        const [{ code: startResponseCode }, { reader, result }] = await Promise.all([
            waitPromise,
            FilePushHandler.getStreamReader(file),
        ]);
        if (startResponseCode !== FilePushResponseStatus.NO_ERROR) {
            this.logError(pushId, fileName, startResponseCode);
            return;
        }
        let receivedBytes = 0;

        const processData = async ({ done, value }: { done: boolean; value?: Uint8Array }): Promise<void> => {
            if (done || !value) {
                this.filePushStream.sendEventFinish({ id: pushId });
                const { code: finishResponseCode } = await this.waitForResponse(pushId);
                if (finishResponseCode !== 0) {
                    this.logError(pushId, fileName, finishResponseCode);
                } else {
                    this.sendUpdate({ pushId, fileName, logString: 'success!', error: false });
                }
                console.log(TAG, `File "${fileName}" uploaded in ${Date.now() - start}ms`);
                return;
            }

            receivedBytes += value.length;
            this.filePushStream.sendEventAppend({ id: pushId, chunk: value });

            const [{ code: appendResponseCode }, result] = await Promise.all([
                this.waitForResponse(pushId),
                reader.read(),
            ]);
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

    private waitForResponse(pushId: number): Promise<PushResponse> {
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

    onStreamError = ({ id, error }: { id: number; error: Error }): void => {
        console.error(TAG, `pushId: ${id}`, error);
    };

    onStreamResponse = (response: PushResponse): void => {
        let func: Resolve;
        let value: PushResponse;
        const { code, id: idInResponse } = response;
        const id = code === FilePushResponseStatus.NEW_PUSH_ID ? FilePushHandler.REQUEST_NEW_PUSH_ID : response.id;
        const resolve = this.responseWaiter.get(id);
        if (!resolve) {
            console.warn(TAG, `Unexpected push id: "${id}", ${JSON.stringify(response)}`);
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
        if (code === FilePushResponseStatus.NEW_PUSH_ID) {
            value = { id, code: idInResponse };
        } else {
            value = { id, code: code };
        }
        func(value);
    };
    public onFilesDrop(files: File[]): boolean {
        this.listeners.forEach((listener) => {
            listener.onDrop();
        });
        files.forEach((file: File) => {
            const { type, name } = file;
            if (this.filePushStream.isAllowedFile(file)) {
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
        return true;
    }

    public static getErrorMessage(code: number, message?: string): string {
        return message || RESPONSE_CODES.get(code) || 'Unknown error';
    }

    public onDragEnter(): boolean {
        let handled = false;
        this.listeners.forEach((listener) => {
            handled = handled || listener.onDragEnter();
        });
        return handled;
    }

    public onDragLeave(): boolean {
        let handled = false;
        this.listeners.forEach((listener) => {
            handled = handled || listener.onDragLeave();
        });
        return handled;
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public release(): void {
        this.filePushStream.off('response', this.onStreamResponse);
        this.filePushStream.off('error', this.onStreamError);
        this.filePushStream.release();
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
    [FilePushResponseStatus.NEW_PUSH_ID, 'New push id'],
    [FilePushResponseStatus.NO_ERROR, 'No error'],

    [FilePushResponseStatus.ERROR_INVALID_NAME, 'Invalid name'],
    [FilePushResponseStatus.ERROR_NO_SPACE, 'No space'],
    [FilePushResponseStatus.ERROR_FAILED_TO_DELETE, 'Failed to delete existing'],
    [FilePushResponseStatus.ERROR_FAILED_TO_CREATE, 'Failed to create new file'],
    [FilePushResponseStatus.ERROR_FILE_NOT_FOUND, 'File not found'],
    [FilePushResponseStatus.ERROR_FAILED_TO_WRITE, 'Failed to write to file'],
    [FilePushResponseStatus.ERROR_FILE_IS_BUSY, 'File is busy'],
    [FilePushResponseStatus.ERROR_INVALID_STATE, 'Invalid state'],
    [FilePushResponseStatus.ERROR_UNKNOWN_ID, 'Unknown id'],
    [FilePushResponseStatus.ERROR_NO_FREE_ID, 'No free id'],
    [FilePushResponseStatus.ERROR_INCORRECT_SIZE, 'Incorrect size'],
]);
