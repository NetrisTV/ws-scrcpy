/// <reference types="node" />
import { EventEmitter } from 'events';
declare class PushTransfer extends EventEmitter {
    private _stack;
    stats: {
        bytesTransferred: number;
    };
    cancel(): boolean;
    push(byteCount: number): number;
    pop(): boolean;
    end(): boolean;
}
export = PushTransfer;
