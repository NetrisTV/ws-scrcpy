import { Optional, ToolBoxElement } from './ToolBoxElement';
import SvgImage, { Icon } from '../ui/SvgImage';

export class ToolBoxButton extends ToolBoxElement<HTMLButtonElement> {
    private readonly btn: HTMLButtonElement;
    constructor(title: string, icon: Icon, optional?: Optional) {
        super(title, optional);
        const btn = document.createElement('button');
        btn.classList.add('control-button');
        btn.title = title;
        btn.appendChild(SvgImage.create(icon));
        this.btn = btn;
    }

    public getElement(): HTMLButtonElement {
        return this.btn;
    }
    public getAllElements(): HTMLElement[] {
        return [this.btn];
    }
}
