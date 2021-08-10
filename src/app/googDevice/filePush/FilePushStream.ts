import { TypedEmitter } from '../../../common/TypedEmitter';

interface FilePushStreamEvents {
    response: { id: number; result: number };
}

export abstract class FilePushStream extends TypedEmitter<FilePushStreamEvents> {
    public abstract hasConnection(): boolean;
    public abstract isAllowedFile(file: File): boolean;
    public abstract sendEventNew(params: { id: number }): void;
    public abstract sendEventStart(params: { id: number; fileName: string; fileSize: number }): void;
    public abstract sendEventFinish(params: { id: number }): void;
    public abstract sendEventAppend(params: { id: number; chunk: Uint8Array }): void;
    public abstract release(): void;
}
