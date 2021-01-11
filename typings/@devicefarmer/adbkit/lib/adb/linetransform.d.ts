/// <reference types="node" />
import Stream, { TransformCallback, TransformOptions } from 'stream';
interface LineTransformOptions extends TransformOptions {
    autoDetect?: boolean;
}
declare class LineTransform extends Stream.Transform {
    private savedR;
    private autoDetect;
    private transformNeeded;
    private skipBytes;
    constructor(options?: LineTransformOptions);
    _nullTransform(chunk: Buffer, encoding: string, done: TransformCallback): void;
    _transform(chunk: Buffer, encoding: string, done: TransformCallback): void;
    _flush(done: TransformCallback): void;
}
export = LineTransform;
