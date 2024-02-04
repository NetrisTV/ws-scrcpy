import { ParamsBase } from './ParamsBase';
import { ACTION } from '../common/Action';

export interface ParamsShell extends ParamsBase {
    action: ACTION.SHELL;
    htmlElementToAppend: HTMLElement;
    udid: string;
}
