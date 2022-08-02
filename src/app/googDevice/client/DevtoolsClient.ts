import '../../../style/devtools.css';
import { ManagerClient } from '../../client/ManagerClient';
import { ACTION } from '../../../common/Action';
import { ParamsDevtools } from '../../../types/ParamsDevtools';
import { RemoteDevtoolsCommand } from '../../../types/RemoteDevtoolsCommand';
import { Message } from '../../../types/Message';
import { DevtoolsInfo, RemoteBrowserInfo, RemoteTarget, TargetDescription } from '../../../types/RemoteDevtools';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import Util from '../../Util';

const FRONTEND_RE = /^https?:\/\/chrome-devtools-frontend\.appspot\.com\/serve_rev\/(@.*)/;

const TAG = '[DevtoolsClient]';

export class DevtoolsClient extends ManagerClient<ParamsDevtools, never> {
    public static readonly ACTION = ACTION.DEVTOOLS;
    public static readonly TIMEOUT = 1000;

    public static start(params: ParamsDevtools): DevtoolsClient {
        return new DevtoolsClient(params);
    }

    private timeout?: number;
    private readonly hiddenInput: HTMLInputElement;
    private readonly tooltip: HTMLSpanElement;
    private hideTimeout?: number;
    private readonly udid: string;
    constructor(params: ParamsDevtools) {
        super(params);
        this.udid = this.params.udid;
        this.openNewConnection();
        this.setTitle(`Devtools ${this.udid}`);
        this.setBodyClass('devtools');
        this.hiddenInput = document.createElement('input');
        this.hiddenInput.className = 'hidden';
        this.hiddenInput.setAttribute('hidden', 'hidden');
        document.body.appendChild(this.hiddenInput);
        this.tooltip = document.createElement('span');
        this.tooltip.innerText = 'Copied!';
        this.tooltip.className = 'tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }

    public static parseParameters(params: URLSearchParams): ParamsDevtools {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.DEVTOOLS) {
            throw Error('Incorrect action');
        }
        return { ...typedParams, action, udid: Util.parseString(params, 'udid', true) };
    }

    private static compareBrowsers = (a: RemoteBrowserInfo, b: RemoteBrowserInfo): number => {
        const aBrowser = a.version.Browser;
        const bBrowser = b.version.Browser;
        if (aBrowser > bBrowser) {
            return 1;
        } else if (aBrowser < bBrowser) {
            return -1;
        }
        return 0;
    };

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        if (typeof this.params.udid === 'string') {
            localUrl.searchParams.set('udid', this.params.udid);
        }
        return localUrl;
    }

    protected onSocketClose(event: CloseEvent): void {
        console.error(TAG, `Socket closed. Code: ${event.code}.${event.reason ? ' Reason: ' + event.reason : ''}`);
        setTimeout(() => {
            this.openNewConnection();
        }, 2000);
    }

    protected onSocketMessage(event: MessageEvent): void {
        let message: Message;
        try {
            message = JSON.parse(event.data);
        } catch (error: any) {
            console.error(TAG, error.message);
            console.log(TAG, error.data);
            return;
        }
        if (message.type !== DevtoolsClient.ACTION) {
            console.log(TAG, `Unknown message type: ${message.type}`);
            return;
        }
        const list = message.data as DevtoolsInfo;
        this.buildList(list);
        if (!this.timeout) {
            this.timeout = window.setTimeout(this.requestListUpdate, DevtoolsClient.TIMEOUT);
        }
    }

    protected onSocketOpen(): void {
        this.requestListUpdate();
    }

    private requestListUpdate = (): void => {
        this.timeout = undefined;
        if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
            return;
        }
        this.ws.send(
            JSON.stringify({
                command: RemoteDevtoolsCommand.LIST_DEVTOOLS,
            }),
        );
    };

    private createDeviceBlock(info: DevtoolsInfo): HTMLDivElement {
        const d = document.createElement('div');
        d.className = 'device';
        d.id = `device:${info.deviceSerial}`;
        return d;
    }
    private createDeviceHeader(info: DevtoolsInfo): HTMLDivElement {
        const h = document.createElement('div');
        h.className = 'device-header';
        const n = document.createElement('div');
        n.className = 'device-name';
        n.innerText = info.deviceName;
        const s = document.createElement('div');
        s.className = 'device-serial';
        s.innerText = `#${info.deviceSerial.toUpperCase()}`;
        const p = document.createElement('div');
        p.className = 'device-ports';
        h.appendChild(n);
        h.appendChild(s);
        h.appendChild(p);
        return h;
    }

    private createBrowsersBlock(info: DevtoolsInfo): HTMLDivElement {
        const { deviceSerial } = info;
        const bs = document.createElement('div');
        bs.className = 'browsers';
        info.browsers.sort(DevtoolsClient.compareBrowsers).forEach((browser) => {
            const b = this.createBrowserBlock(deviceSerial, browser);
            bs.appendChild(b);
        });
        return bs;
    }

    private createBrowserBlock(serial: string, info: RemoteBrowserInfo): HTMLDivElement {
        const { socket } = info;
        const b = document.createElement('div');
        b.id = `${serial}:${socket}`;
        b.className = 'browser';
        const h = document.createElement('div');
        h.className = 'browser-header';
        b.appendChild(h);
        const n = document.createElement('div');
        n.className = 'browser-name';

        h.appendChild(n);
        const pkg = info.version['Android-Package'];
        const browser = info.version.Browser;
        let version: string;
        const temp = browser.split('/');
        if (temp.length > 1) {
            version = temp[1];
        } else {
            version = browser;
        }
        const prefix = socket.indexOf('webview') === 0 ? 'WebView in ' : '';
        n.innerText = `${prefix}${pkg}(${version})`;
        const s = document.createElement('span');
        s.setAttribute('tabIndex', '1');
        s.className = 'action';
        s.innerText = 'trace';
        s.setAttribute('hidden', 'hidden');
        h.appendChild(s);
        const pages = document.createElement('div');
        pages.className = 'list pages';
        info.targets.forEach((page) => {
            pages.appendChild(this.createPageBlock(page, version));
        });
        b.appendChild(pages);
        return b;
    }

    private createPageBlock(page: RemoteTarget, version?: string): HTMLDivElement {
        const row = document.createElement('div');
        row.className = 'row';
        const props = document.createElement('div');
        props.className = 'properties-box';
        row.appendChild(props);
        if (page.faviconUrl) {
            const img = document.createElement('img');
            img.src = page.faviconUrl;
            props.appendChild(img);
        }
        const subrow = document.createElement('div');
        subrow.className = 'subrow-box';
        props.appendChild(subrow);
        const sub1 = document.createElement('div');
        sub1.className = 'subrow';
        subrow.appendChild(sub1);
        const n = document.createElement('div');
        n.className = 'name';
        if (page.title) {
            n.innerText = page.title;
        }
        sub1.appendChild(n);
        const u = document.createElement('div');
        u.className = 'url';
        if (page.url) {
            u.innerText = page.url;
        }
        sub1.appendChild(u);
        const sub2 = document.createElement('div');
        sub2.className = 'subrow webview';
        subrow.appendChild(sub2);
        if (page.description) {
            try {
                const desc = JSON.parse(page.description) as TargetDescription;
                const position = document.createElement('div');
                position.className = 'position';
                position.innerText = `at (${desc.screenX}, ${desc.screenY})`;
                sub2.appendChild(position);
                const size = document.createElement('div');
                size.className = 'size';
                size.innerText = `size ${desc.width} × ${desc.height}`;
                sub2.appendChild(size);
            } catch (error: any) {}
        }
        const absoluteAddress = page.devtoolsFrontendUrl && page.devtoolsFrontendUrl.startsWith('http');

        const actions = document.createElement('div');
        actions.className = 'actions';
        subrow.appendChild(actions);
        const inspect = document.createElement('a');
        inspect.setAttribute('tabIndex', '1');
        inspect.className = 'action';
        inspect.innerText = 'inspect';
        actions.appendChild(inspect);

        if (page.devtoolsFrontendUrl) {
            inspect.setAttribute('href', page.devtoolsFrontendUrl);
            inspect.setAttribute('rel', 'noopener noreferrer');
            inspect.setAttribute('target', '_blank');
        } else {
            inspect.classList.add('disabled');
        }

        if (!absoluteAddress) {
            inspect.classList.add('disabled');
        }

        if (page.webSocketDebuggerUrl) {
            const bundled = document.createElement('a');
            bundled.setAttribute('tabIndex', '1');
            bundled.className = 'action copy';
            bundled.innerText = 'bundled';
            bundled.title = 'Copy link and open manually';
            actions.appendChild(bundled);

            const base = 'devtools://devtools/bundled/inspector.html?experiments=true&ws=';
            bundled.setAttribute('href', `${base}${page.webSocketDebuggerUrl}`);
            bundled.setAttribute('rel', 'noopener noreferrer');
            bundled.setAttribute('target', '_blank');
            bundled.onclick = this.onDevtoolsLinkClick;
        }

        if (page.devtoolsFrontendUrl && page.webSocketDebuggerUrl && absoluteAddress) {
            const ur = new URL(page.devtoolsFrontendUrl);
            ur.searchParams.delete('ws');
            const urStr = ur.toString();
            const match = urStr.match(FRONTEND_RE);
            if (match) {
                const str = match[1];
                const temp = str.split('/');
                const revision = temp.shift();
                const rest = temp.join('/');
                const remoteVersion = version ? `remoteVersion=${version}&` : '';
                const opts = `remoteFrontend=true&dockSide=undocked&`;
                const ws = `ws=${page.webSocketDebuggerUrl}`;
                const url = `devtools://devtools/remote/serve_rev/${revision}/${rest}?${remoteVersion}${opts}${ws}`;

                const remote = document.createElement('a');
                remote.setAttribute('tabIndex', '1');
                remote.className = 'action copy';
                remote.innerText = 'remote';
                remote.title = 'Copy link and open manually';
                actions.appendChild(remote);

                remote.setAttribute('href', url);
                remote.setAttribute('rel', 'noopener noreferrer');
                remote.setAttribute('target', '_blank');
                remote.onclick = this.onDevtoolsLinkClick;
            }
        }

        const pause = document.createElement('span');
        pause.setAttribute('hidden', 'hidden');
        pause.setAttribute('tabIndex', '1');
        pause.className = 'action';
        pause.innerText = 'pause';
        actions.appendChild(pause);
        return row;
    }

    private onDevtoolsLinkClick = (event: MouseEvent): void => {
        const a = event.target as HTMLAnchorElement;
        const url = a.getAttribute('href');
        if (!url) {
            return;
        }
        this.hiddenInput.value = url;
        this.hiddenInput.removeAttribute('hidden');
        this.hiddenInput.select();
        this.hiddenInput.setSelectionRange(0, url.length);
        document.execCommand('copy');
        this.hiddenInput.setAttribute('hidden', 'hidden');
        this.tooltip.style.left = `${event.clientX}px`;
        this.tooltip.style.top = `${event.clientY}px`;
        this.tooltip.style.display = 'block';
        this.hideTooltip();
        event.preventDefault();
    };

    private hideTooltip() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = window.setTimeout(() => {
            this.hideTimeout = undefined;
            this.tooltip.style.display = 'none';
        }, 1000);
    }

    public buildList(info: DevtoolsInfo): void {
        // console.log(info);
        const block = this.createDeviceBlock(info);
        const header = this.createDeviceHeader(info);
        const browsers = this.createBrowsersBlock(info);
        block.appendChild(header);
        block.appendChild(browsers);
        const old = document.getElementById(block.id);
        if (old) {
            old.parentElement?.replaceChild(block, old);
        } else {
            document.body.appendChild(block);
        }
    }

    public static createEntryForDeviceList(
        descriptor: GoogDeviceDescriptor,
        blockClass: string,
        params: ParamsDeviceTracker,
    ): HTMLElement | DocumentFragment | undefined {
        if (descriptor.state !== 'device') {
            return;
        }
        const entry = document.createElement('div');
        entry.classList.add('devtools', blockClass);
        entry.appendChild(
            BaseDeviceTracker.buildLink(
                {
                    action: ACTION.DEVTOOLS,
                    udid: descriptor.udid,
                },
                'devtools',
                params,
            ),
        );
        return entry;
    }
}
