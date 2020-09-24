import { ManagerClient } from './ManagerClient';
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';
import { FitAddon } from 'xterm-addon-fit';
import { ParsedUrlQueryInput } from 'querystring';
import { Message } from '../common/Message';

export interface ShellParams extends ParsedUrlQueryInput {
    action: 'shell';
    udid: string;
}

export class ShellClient extends ManagerClient {
    public static ACTION = 'shell';
    public static start(params: ShellParams): ShellClient {
        return new ShellClient(params.action, params.udid);
    }
    private readonly term: Terminal;
    private readonly fitAddon: FitAddon;
    private readonly escapedUdid: string;

    constructor(action: string, private readonly udid: string) {
        super(action);
        this.ws.onopen = this.onSocketOpen.bind(this);
        this.setTitle(`Shell ${udid}`);
        this.setBodyClass('shell');
        this.term = new Terminal();
        this.term.loadAddon(new AttachAddon(this.ws));
        this.fitAddon = new FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.escapedUdid = this.escapeUdid(udid);
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
        const message: Message = {
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
}
