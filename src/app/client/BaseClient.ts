import { TypedEmitter } from '../../common/TypedEmitter';
import { ParamsBase } from '../../types/ParamsBase';
import Util from '../Util';

export class BaseClient<P extends ParamsBase, TE> extends TypedEmitter<TE> {
    protected title = 'BaseClient';
    protected params: P;

    protected constructor(params: P) {
        super();
        this.params = params;
    }

    public static parseParameters(query: URLSearchParams): ParamsBase {
        const action = Util.parseStringEnv(query.get('action'));
        if (!action) {
            throw TypeError('Invalid action');
        }
        return {
            action: action,
            useProxy: Util.parseBooleanEnv(query.get('useProxy')),
            secure: Util.parseBooleanEnv(query.get('secure')),
            hostname: Util.parseStringEnv(query.get('hostname')),
            port: Util.parseIntEnv(query.get('port')),
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
