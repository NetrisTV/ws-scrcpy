import { ParsedUrlQueryInput } from 'querystring';

export interface ScrcpyStreamParams extends ParsedUrlQueryInput {
    action: 'stream';
    udid: string;
    player: string;
    ip: string;
    port: string;
    query?: string;
}
