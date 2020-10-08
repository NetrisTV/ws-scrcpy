import { ParsedUrlQueryInput } from 'querystring';
import { Decoders } from './Decoders';

export interface ScrcpyStreamParams extends ParsedUrlQueryInput {
    action: 'stream';
    udid: string;
    decoder: Decoders;
    ip: string;
    port: string;
    query?: string;
}
