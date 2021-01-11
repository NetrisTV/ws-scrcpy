import { ExtendedPublicKey } from '../ExtendedPublicKey';
import Bluebird from 'bluebird';
declare class Auth {
    private static RE;
    static parsePublicKey(buffer: string): Bluebird<ExtendedPublicKey>;
    private static readPublicKeyFromStruct;
}
export = Auth;
