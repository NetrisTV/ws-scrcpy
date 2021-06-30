import KeyEvent from '../android/KeyEvent';
import {Optional, ToolBoxElement} from '../../toolbox/ToolBoxElement';
import {StreamClientScrcpy} from '../client/StreamClientScrcpy';
import BtnUnlockPng from '../../../public/images/buttons/btn-unlock.png';
import BtnBackPng from '../../../public/images/buttons/btn-back.png';
import BtnHomePng from '../../../public/images/buttons/btn-home.png';
import BtnRotatePng from '../../../public/images/buttons/btn-rotate.png';
import {KeyCodeControlMessage} from '../../controlMessage/KeyCodeControlMessage';
import {CommandControlMessage} from '../../controlMessage/CommandControlMessage';
import {ControlMessage} from '../../controlMessage/ControlMessage';

const BUTTONS = [
    {
        title: 'Unlock',
        code: KeyEvent.KEYCODE_MENU,
        icon: BtnUnlockPng,
        type: 'KeyCodeControlMessage',
    },
    {
        title: 'Home',
        code: KeyEvent.KEYCODE_HOME,
        icon: BtnHomePng,
        type: 'KeyCodeControlMessage',
    },
    {
        title: 'Rotate',
        code: KeyEvent.KEYCODE_APP_SWITCH,
        icon: BtnRotatePng,
        type: 'CommandControlMessage',
    },
    {
        title: 'Back',
        code: KeyEvent.KEYCODE_BACK,
        icon: BtnBackPng,
        type: 'KeyCodeControlMessage',
    },
];

export class ToolBoxButton2 extends ToolBoxElement<HTMLButtonElement> {
    private readonly btn: HTMLButtonElement;

    constructor(title: string, icon: string, optional?: Optional) {
        super(title, optional);
        const btn = document.createElement('button');
        btn.classList.add('control-header-button');
        btn.title = title;

        const img = document.createElement('img');
        img.src = icon;

        btn.appendChild(img);
        this.btn = btn;
    }

    public getElement(): HTMLButtonElement {
        return this.btn;
    }

    public getAllElements(): HTMLElement[] {
        return [this.btn];
    }
}

export class DroidToolBox2 {
    private readonly holder: HTMLElement;

    protected constructor(list: ToolBoxElement<any>[]) {
        this.holder = document.createElement('div');
        this.holder.classList.add('control-header');
        list.forEach((item) => {
            item.getAllElements().forEach((el) => {
                this.holder.appendChild(el);
            });
        });

        const controlHeaderText = document.createElement('div');
        controlHeaderText.id = 'control-header-text';
        controlHeaderText.className = 'control-header-text';
        this.holder.appendChild(controlHeaderText);
    }

    public static createToolBox(client: StreamClientScrcpy): DroidToolBox2 {
        const list = BUTTONS.slice();
        const handler = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(
            type: K,
            element: ToolBoxElement<T>,
        ) => {
            if (!element.optional?.code || !element.optional?.type) {
                return;
            }

            const action = type === 'mousedown' ? KeyEvent.ACTION_DOWN : KeyEvent.ACTION_UP;
            if (element.optional?.type === 'KeyCodeControlMessage') {
                const event = new KeyCodeControlMessage(action, element.optional?.code, 0, 0);
                client.sendMessage(event);
            } else if (element.optional?.type === 'CommandControlMessage') {
                const title = element.optional?.title;
                if (title === 'Rotate') {
                    const action = ControlMessage.TYPE_ROTATE_DEVICE;
                    const event = new CommandControlMessage(action);
                    client.sendMessage(event);
                }
            } else {
                console.log('ERROR: wrong type');
            }
        };

        const elements: ToolBoxElement<any>[] = list.map((item) => {
            const button = new ToolBoxButton2(item.title, item.icon, {
                code: item.code,
                type: item.type,
                title: item.title,
            });

            if (item.type === 'KeyCodeControlMessage') {
                button.addEventListener('mousedown', handler);
            }
            button.addEventListener('mouseup', handler);
            return button;
        });

        return new DroidToolBox2(elements);
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }
}
