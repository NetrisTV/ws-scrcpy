import { ToolBox } from '../../toolbox/ToolBox';
import SvgImage from '../../ui/SvgImage';
import { BasePlayer } from '../../player/BasePlayer';
import { ToolBoxButton } from '../../toolbox/ToolBoxButton';
import { ToolBoxElement } from '../../toolbox/ToolBoxElement';
import { ToolBoxCheckbox } from '../../toolbox/ToolBoxCheckbox';
import WdaConnection from '../WdaConnection';
import { StreamClientQVHack } from '../client/StreamClientQVHack';

const BUTTONS = [
    {
        title: 'Home',
        name: 'home',
        icon: SvgImage.Icon.HOME,
    },
];

export class QVHackToolBox extends ToolBox {
    protected constructor(list: ToolBoxElement<any>[]) {
        super(list);
    }

    public static createToolBox(
        udid: string,
        player: BasePlayer,
        client: StreamClientQVHack,
        wdaConnection: WdaConnection,
        moreBox?: HTMLElement,
    ): QVHackToolBox {
        const playerName = player.getName();
        const list = BUTTONS.slice();
        const handler = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(
            _: K,
            element: ToolBoxElement<T>,
        ) => {
            if (!element.optional?.name) {
                return;
            }
            const { name } = element.optional;
            wdaConnection.wdaPressButton(name);
        };
        const elements: ToolBoxElement<any>[] = list.map((item) => {
            const button = new ToolBoxButton(item.title, item.icon, {
                name: item.name,
            });
            button.addEventListener('click', handler);
            return button;
        });
        if (player.supportsScreenshot) {
            const screenshot = new ToolBoxButton('Take screenshot', SvgImage.Icon.CAMERA);
            screenshot.addEventListener('click', () => {
                player.createScreenshot(client.getDeviceName());
            });
            elements.push(screenshot);
        }

        if (moreBox) {
            const more = new ToolBoxCheckbox('More', SvgImage.Icon.MORE, `show_more_${udid}_${playerName}`);
            more.addEventListener('click', (_, el) => {
                const element = el.getElement();
                moreBox.style.display = element.checked ? 'block' : 'none';
            });
            elements.unshift(more);
        }
        return new QVHackToolBox(elements);
    }
}
