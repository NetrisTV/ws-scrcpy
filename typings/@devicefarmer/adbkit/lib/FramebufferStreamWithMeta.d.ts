/// <reference types="node" />
import { Duplex } from 'stream';
import { FramebufferMeta } from './FramebufferMeta';
export interface FramebufferStreamWithMeta extends Duplex {
    meta: FramebufferMeta;
}
