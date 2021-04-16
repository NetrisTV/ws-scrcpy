import { ParsedUrlQueryInput } from 'querystring';

export interface QVHackStreamParams extends ParsedUrlQueryInput {
    action: 'stream-qvh';
    udid: string;
}
