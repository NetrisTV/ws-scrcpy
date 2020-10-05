import { ParsedUrlQueryInput } from 'querystring';

export interface QVHackStreamParams extends ParsedUrlQueryInput {
    action: 'stream-qvh';
    udid: string;
    ip: string;
    port: string;
}
