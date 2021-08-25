import { Readable, ReadableOptions } from 'stream';

export class ReadStream extends Readable {
    private _bytesRead = 0;
    constructor(private readonly _path: string, opts?: ReadableOptions) {
        super(opts);
    }
    public get bytesRead(): number {
        return this._bytesRead;
    }
    public get path(): string | Buffer {
        return this._path;
    }
    public push(chunk: any, encoding?: string): boolean {
        if (chunk) {
            this._bytesRead += chunk.length;
        }
        return super.push(chunk, encoding);
    }

    public close(): void {
        this.destroy();
    }
}
