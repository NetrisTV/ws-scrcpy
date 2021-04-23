import { TypedEmitter } from '../../common/TypedEmitter';
import { ParamsBase } from '../../types/ParamsBase';
import { ParsedUrlQuery } from 'querystring';
import Util from '../Util';

export class BaseClient<P extends ParamsBase, TE> extends TypedEmitter<TE> {
    protected title = 'BaseClient';
    protected params: P;

    protected constructor(query: ParsedUrlQuery | P) {
        super();
        this.params = this.parseParameters(query) as P;
    }

    protected parseParameters(query: ParsedUrlQuery | P): ParamsBase {
        return {
            action: Util.parseStringEnv(query.action),
            useProxy: Util.parseBooleanEnv(query.useProxy),
            secure: Util.parseBooleanEnv(query.secure),
            hostname: Util.parseStringEnv(query.hostname),
            port: Util.parseIntEnv(query.port),
        };
    }

    public setTitle(text = this.title): void {
        let titleTag: HTMLTitleElement | null = document.querySelector('head > title');
        if (!titleTag) {
            titleTag = document.createElement('title');
        }
        titleTag.innerText = text;
    }

    public setBodyClass(text: string): void {
        document.body.className = text;
    }
}
