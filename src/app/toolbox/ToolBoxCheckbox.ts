import { Optional, ToolBoxElement } from './ToolBoxElement';
import SvgImage, { Icon } from '../ui/SvgImage';

export class ToolBoxCheckbox extends ToolBoxElement<HTMLInputElement> {
    private readonly input: HTMLInputElement;
    private readonly label: HTMLLabelElement;
    constructor(title: string, icon: Icon, opt_id?: string, optional?: Optional) {
        super(title, icon, optional);
        const input = document.createElement('input');
        input.type = 'checkbox';
        const label = document.createElement('label');
        label.title = title;
        label.classList.add('control-button');
        label.appendChild(SvgImage.create(icon));
        const id = opt_id || title.toLowerCase().replace(' ', '_');
        label.htmlFor = input.id = `input_${id}`;
        this.input = input;
        this.label = label;
    }

    public getElement(): HTMLInputElement {
        return this.input;
    }

    public getAllElements(): HTMLElement[] {
        return [this.input, this.label];
    }
}
