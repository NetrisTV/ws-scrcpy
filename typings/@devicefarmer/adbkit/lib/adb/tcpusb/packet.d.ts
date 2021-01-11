/// <reference types="node" />
declare class Packet {
    readonly command: number;
    readonly arg0: number;
    readonly arg1: number;
    readonly length: number;
    readonly check: number;
    readonly magic: number;
    data?: Buffer;
    static A_SYNC: number;
    static A_CNXN: number;
    static A_OPEN: number;
    static A_OKAY: number;
    static A_CLSE: number;
    static A_WRTE: number;
    static A_AUTH: number;
    static checksum(data?: Buffer): number;
    static magic(command: number): number;
    static assemble(command: number, arg0: number, arg1: number, data: Buffer): Buffer;
    static swap32(n: number): number;
    constructor(command: number, arg0: number, arg1: number, length: number, check: number, magic: number, data?: Buffer);
    verifyChecksum(): boolean;
    verifyMagic(): boolean;
    private getType;
    toString(): string;
}
export = Packet;
