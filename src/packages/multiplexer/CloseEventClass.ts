import { Event2 } from './Event';

export class CloseEvent2 extends Event2 implements CloseEvent {
    readonly code: number;
    readonly reason: string;
    readonly wasClean: boolean;
    constructor(type: string, { code, reason }: CloseEventInit = {}) {
        super(type);
        this.code = code || 0;
        this.reason = reason || '';
        this.wasClean = this.code === 0;
    }
}

export const CloseEventClass = typeof CloseEvent !== 'undefined' ? CloseEvent : CloseEvent2;
