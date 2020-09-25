import { ParsedUrlQueryInput } from 'querystring';

export interface ShellParams extends ParsedUrlQueryInput {
    action: 'shell';
    udid: string;
}
