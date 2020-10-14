import { ExtendedPublicKey } from './ExtendedPublicKey';
import Bluebird from 'bluebird';
export interface SocketOptions {
    auth?: (key: ExtendedPublicKey) => Bluebird<void | boolean>;
}
