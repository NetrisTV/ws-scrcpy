import { ParsedUrlQueryInput } from 'querystring';
import { Players } from './Players';

export interface ScrcpyStreamParams extends ParsedUrlQueryInput {
    action: 'stream';
    udid: string;
    player: Players;
    ip: string;
    port: string;
    query?: string;
}
