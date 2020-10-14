import { pki } from 'node-forge';
import PublicKey = pki.rsa.PublicKey;
export interface ExtendedPublicKey extends PublicKey {
    fingerprint: string;
    comment: string;
}
