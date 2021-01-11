/// <reference types="node" />
import Bluebird from 'bluebird';
import { Duplex } from 'stream';
declare class FailError extends Error {
    constructor(message: string);
}
declare class PrematureEOFError extends Error {
    missingBytes: number;
    constructor(howManyMissing: number);
}
declare class UnexpectedDataError extends Error {
    unexpected: string;
    expected: string;
    constructor(unexpected: string, expected: string);
}
declare class Parser {
    stream: Duplex;
    static FailError: typeof FailError;
    static PrematureEOFError: typeof PrematureEOFError;
    static UnexpectedDataError: typeof UnexpectedDataError;
    private ended;
    constructor(stream: Duplex);
    end(): Bluebird<boolean>;
    raw(): Duplex;
    readAll(): Bluebird<Buffer>;
    readAscii(howMany: number): Bluebird<string>;
    readBytes(howMany: number): Bluebird<Buffer>;
    readByteFlow(howMany: number, targetStream: Duplex): Bluebird<void>;
    readError(): Bluebird<never>;
    readValue(): Bluebird<Buffer>;
    readUntil(code: number): Bluebird<Buffer>;
    searchLine(re: RegExp): Bluebird<RegExpExecArray>;
    readLine(): Bluebird<Buffer>;
    unexpected(data: string, expected: string): Bluebird<never>;
}
export = Parser;
