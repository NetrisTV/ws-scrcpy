import * as querystring from 'querystring';
import { ManagerClient } from './ManagerClient';
import { Message } from '../../common/Message';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import { ShellParams } from '../../common/ShellParams';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';

export type MapItem<T> = {
    field?: keyof T;
    title: string;
};

export abstract class DeviceTrackerClient<T extends DroidDeviceDescriptor> extends ManagerClient {
    public static ACTION = 'devicelist';
    protected tableId = 'devicesList';

    protected constructor(action: string, protected rows: MapItem<T>[]) {
        super(action);
        this.setBodyClass('list');
        this.setTitle('Device list');
    }

    protected abstract buildDeviceTable(data: T[]): void;

    protected onSocketClose(e: CloseEvent): void {
        console.log(`Connection closed: ${e.reason}`);
        setTimeout(() => {
            this.openNewWebSocket();
        }, 2000);
    }

    protected onSocketMessage(e: MessageEvent): void {
        let message: Message;
        try {
            message = JSON.parse(e.data);
        } catch (error) {
            console.error(error.message);
            console.log(e.data);
            return;
        }
        if (message.type !== DeviceTrackerClient.ACTION) {
            console.log(`Unknown message type: ${message.type}`);
            return;
        }
        const list: T[] = message.data as T[];
        this.buildDeviceTable(list);
    }

    protected getOrBuildTableBody(parent: HTMLElement): Element {
        let tbody = document.querySelector(`#devices table#${this.tableId} tbody`) as Element;
        if (!tbody) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            this.rows.forEach((item) => {
                const { title } = item;
                const td = document.createElement('th');
                td.innerText = title;
                td.className = title.toLowerCase();
                headRow.appendChild(td);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);
            tbody = document.createElement('tbody');
            table.id = this.tableId;
            table.appendChild(tbody);
            table.setAttribute('width', '100%');
            parent.appendChild(table);
        } else {
            while (tbody.children.length) {
                tbody.removeChild(tbody.children[0]);
            }
        }
        return tbody;
    }

    protected static buildLink(
        q: ScrcpyStreamParams | ShellParams,
        text: string,
    ): HTMLAnchorElement {
        const hash = `#!${querystring.encode(q)}`;
        const a = document.createElement('a');
        a.setAttribute('href', `${location.origin}${location.pathname}${hash}`);
        a.setAttribute('rel', 'noopener noreferrer');
        a.setAttribute('target', '_blank');
        a.innerText = text;
        return a;
    }
}
