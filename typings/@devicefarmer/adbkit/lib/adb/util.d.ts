/// <reference types="node" />
import { Callback } from '../Callback';
import { ExtendedPublicKey } from '../ExtendedPublicKey';
import Bluebird from 'bluebird';
import { Duplex } from 'stream';
declare class Util {
    static readAll(stream: Duplex, callback?: Callback<Buffer>): Bluebird<Buffer>;
    static parsePublicKey(keyString: string, callback?: Callback<ExtendedPublicKey>): Bluebird<ExtendedPublicKey>;
}
export = Util;
