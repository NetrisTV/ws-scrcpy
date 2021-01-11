/// <reference types="node" />
declare class Protocol {
    static OKAY: string;
    static FAIL: string;
    static STAT: string;
    static LIST: string;
    static DENT: string;
    static RECV: string;
    static DATA: string;
    static DONE: string;
    static SEND: string;
    static QUIT: string;
    static decodeLength(length: string): number;
    static encodeLength(length: number): string;
    static encodeData(data: Buffer | string): Buffer;
}
export = Protocol;
