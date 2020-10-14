/// <reference types="node" />
import { Stream, TransformCallback, TransformOptions } from 'stream';
import { FramebufferMeta } from '../../FramebufferMeta';
declare class RgbTransform extends Stream.Transform {
    private meta;
    private _buffer;
    private readonly _r_pos;
    private readonly _g_pos;
    private readonly _b_pos;
    private readonly _a_pos;
    private readonly _pixel_bytes;
    constructor(meta: FramebufferMeta, options?: TransformOptions);
    _transform(chunk: Buffer, encoding: string, done: TransformCallback): void;
}
export = RgbTransform;
