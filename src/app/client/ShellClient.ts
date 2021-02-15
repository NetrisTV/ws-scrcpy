import 'xterm/css/xterm.css';
import { ManagerClient } from './ManagerClient';
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';
import { FitAddon } from 'xterm-addon-fit';
import { MessageXtermClient } from '../../common/MessageXtermClient';
import { ACTION } from '../../server/Constants';
import { ShellParams } from '../../common/ShellParams';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import { BaseDeviceTracker } from './BaseDeviceTracker';
import Util from '../Util';

export class ShellClient extends ManagerClient<never> {
    public static ACTION = ACTION.SHELL;
    public static start(params: ShellParams): ShellClient {
        return new ShellClient(params.action, params.udid);
    }
    private readonly term: Terminal;
    private readonly fitAddon: FitAddon;
    private readonly escapedUdid: string;

    constructor(action: string, private readonly udid: string) {
        super(action);
        this.openNewWebSocket();
        const ws = this.ws as WebSocket;
        this.setTitle(`Shell ${udid}`);
        this.setBodyClass('shell');
        this.term = new Terminal();
        this.term.loadAddon(new AttachAddon(ws));
        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.escapedUdid = Util.escapeUdid(udid);
        this.term.open(ShellClient.getOrCreateContainer(this.escapedUdid));
        this.updateTerminalSize();
    }

    protected onSocketOpen = (): void => {
        this.startShell(this.udid);
    };

    protected onSocketClose(e: CloseEvent): void {
        console.log(`Connection closed: ${e.reason}`);
        this.term.dispose();
    }

    protected onSocketMessage(): void {
        // messages are processed by Attach Addon
    }

    public startShell(udid: string): void {
        if (!udid || !this.ws || this.ws.readyState !== this.ws.OPEN) {
            return;
        }
        const { rows, cols } = this.fitAddon.proposeDimensions();
        const message: MessageXtermClient = {
            id: 1,
            type: 'shell',
            data: {
                type: 'start',
                rows,
                cols,
                udid,
            },
        };
        this.ws.send(JSON.stringify(message));
    }

    protected buildWebSocketUrl(): string {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        return `${proto}://${location.host}/?action=${this.action}&`;
    }

    private static getOrCreateContainer(udid: string): HTMLElement {
        let container = document.getElementById(udid);
        if (!container) {
            container = document.createElement('div');
            container.className = 'terminal-container';
            container.id = udid;
            document.body.appendChild(container);
        }
        return container;
    }

    private updateTerminalSize(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term: any = this.term;
        const terminalContainer: HTMLElement = ShellClient.getOrCreateContainer(this.escapedUdid);
        const { rows, cols } = this.fitAddon.proposeDimensions();
        const width =
            (cols * term._core._renderService.dimensions.actualCellWidth + term._core.viewport.scrollBarWidth).toFixed(
                2,
            ) + 'px';
        const height = (rows * term._core._renderService.dimensions.actualCellHeight).toFixed(2) + 'px';
        terminalContainer.style.width = width;
        terminalContainer.style.height = height;
        this.fitAddon.fit();
    }

    public static createEntryForDeviceList(
        descriptor: DroidDeviceDescriptor,
        blockClass: string,
    ): HTMLElement | DocumentFragment | undefined {
        if (descriptor.state !== 'device') {
            return;
        }
        const entry = document.createElement('div');
        entry.classList.add('shell', blockClass);
        entry.appendChild(
            BaseDeviceTracker.buildLink(
                {
                    action: ACTION.SHELL,
                    udid: descriptor.udid,
                },
                'shell',
            ),
        );
        return entry;
    }
}
