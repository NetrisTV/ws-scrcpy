import { ToolBoxElement } from './ToolBoxElement';

export class ToolBox {
    private readonly holder: HTMLElement;
    private show = false;

    constructor(list: ToolBoxElement<any>[]) {
        this.holder = document.createElement('div');
        this.holder.classList.add('control-buttons-list', 'control-wrapper');

        const hideButton = document.createElement('button');
        hideButton.innerText = '>';
        hideButton.classList.add('hide-button')
        hideButton.onclick = () => {
            this.show = !this.show;
            if (this.show) {
                this.holder.style.width = '50px'
            } else {
                this.holder.style.width = '0px'
            }
        }
        this.holder.appendChild(hideButton)

        const buttons = document.createElement('div')
        buttons.classList.add('tool-box-button-container')
        list.forEach((item) => {
            item.getAllElements().forEach((el) => {
                buttons.appendChild(el);
            });
        });
        this.holder.appendChild(buttons)
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }
}
