/// <reference types="node" />
import Command from '../../command';
import { Readable } from 'stream';
import { FramebufferMeta } from '../../../FramebufferMeta';
import { FramebufferStreamWithMeta } from '../../../FramebufferStreamWithMeta';
import * as Bluebird from 'bluebird';
declare class FrameBufferCommand extends Command<any> {
    execute(format: string): Bluebird<FramebufferStreamWithMeta>;
    _convert(meta: FramebufferMeta, format: string, raw?: Readable): Readable;
    _parseHeader(header: Buffer): FramebufferMeta;
}
export = FrameBufferCommand;
