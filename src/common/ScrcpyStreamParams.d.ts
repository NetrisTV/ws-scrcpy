import { ParsedUrlQueryInput } from 'querystring';

export interface ScrcpyStreamParams extends ParsedUrlQueryInput {
    action: 'stream';
    udid: string;
    player?: string;
    decoder?: string; // TODO: remove deprecated
    ip: string;
    port: string;
    query?: string;
}
