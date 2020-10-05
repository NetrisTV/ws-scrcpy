import { ToolBox } from './ToolBox';
import SvgImage from '../ui/SvgImage';
import Decoder from '../decoder/Decoder';
import { ToolBoxButton } from './ToolBoxButton';
import { ToolBoxElement } from './ToolBoxElement';
import { ToolBoxCheckbox } from './ToolBoxCheckbox';
import WdaConnection from '../WdaConnection';
import { QVHackStreamClient } from '../client/QVHackStreamClient';

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
        decoder: Decoder,
        client: QVHackStreamClient,
        wdaConnection: WdaConnection,
        moreBox?: HTMLElement,
    ) {
        const decoderName = decoder.getName();
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
        if (decoder.supportsScreenshot) {
            const screenshot = new ToolBoxButton('Take screenshot', SvgImage.Icon.CAMERA);
            screenshot.addEventListener('click', () => {
                decoder.createScreenshot(client.getDeviceName());
            });
            elements.push(screenshot);
        }

        if (moreBox) {
            const more = new ToolBoxCheckbox('More', SvgImage.Icon.MORE, `show_more_${udid}_${decoderName}`);
            more.addEventListener('click', (_, el) => {
                const element = el.getElement();
                moreBox.style.display = element.checked ? 'block' : 'none';
            });
            elements.unshift(more);
        }
        return new QVHackToolBox(elements);
    }
}
