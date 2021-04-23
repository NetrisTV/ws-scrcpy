import { TypedEmitter } from '../../common/TypedEmitter';

export class BaseClient<T> extends TypedEmitter<T> {
    protected title = 'BaseClient';

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
