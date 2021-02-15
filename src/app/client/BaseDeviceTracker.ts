import * as querystring from 'querystring';
import { ManagerClient } from './ManagerClient';
import { Message } from '../../common/Message';
import { ShellParams } from '../../common/ShellParams';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { QVHackStreamParams } from '../../common/QVHackStreamParams';
import { DevtoolsParams } from '../../common/DevtoolsParams';
import { BaseDeviceDescriptor } from '../../common/BaseDeviceDescriptor';

export type MapItem<T> = {
    field?: keyof T;
    title: string;
};

export abstract class BaseDeviceTracker<T extends BaseDeviceDescriptor, K> extends ManagerClient<K> {
    public static readonly ACTION_LIST = 'devicelist';
    public static readonly ACTION_DEVICE = 'device';
    public static readonly HOLDER_ELEMENT_ID = 'devices';
    protected title = 'Device list';
    protected tableId = 'droid_device_list';
    protected descriptors: T[] = [];

    protected constructor(action: string) {
        super(action);
        this.setBodyClass('list');
        this.setTitle();
        this.openNewWebSocket();
    }

    protected abstract buildDeviceTable(): void;

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
        switch (message.type) {
            case BaseDeviceTracker.ACTION_LIST:
                this.descriptors = message.data as T[];
                this.buildDeviceTable();
                break;
            case BaseDeviceTracker.ACTION_DEVICE:
                this.updateDescriptor(message.data as T);
                this.buildDeviceTable();
                break;
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
    }

    protected getOrCreateTableHolder(): HTMLElement {
        const id = BaseDeviceTracker.HOLDER_ELEMENT_ID;
        let devices = document.getElementById(id);
        if (!devices) {
            devices = document.createElement('div');
            devices.id = id;
            devices.className = 'table-wrapper';
            document.body.appendChild(devices);
        }
        return devices;
    }

    protected updateDescriptor(descriptor: T): void {
        const idx = this.descriptors.findIndex((item: T) => {
            return item.udid === descriptor.udid;
        });
        if (idx !== -1) {
            this.descriptors[idx] = descriptor;
        } else {
            this.descriptors.push(descriptor);
        }
    }

    protected abstract buildTableHead(): HTMLTableSectionElement;

    protected getOrBuildTableBody(parent: HTMLElement): Element {
        let tbody = document.querySelector(`#devices table#${this.tableId} tbody`) as Element;
        if (!tbody) {
            const table = document.createElement('table');
            const thead = this.buildTableHead();
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

    public static buildLink(
        q: ScrcpyStreamParams | DevtoolsParams | ShellParams | QVHackStreamParams,
        text: string,
    ): HTMLAnchorElement {
        const hash = `#!${querystring.encode(q)}`;
        const a = document.createElement('a');
        a.setAttribute('href', `${location.origin}${location.pathname}${hash}`);
        a.setAttribute('rel', 'noopener noreferrer');
        a.setAttribute('target', '_blank');
        a.classList.add(`link-${q.action}`);
        a.innerText = text;
        return a;
    }

    public getDescriptorByUdid(udid: string): T | undefined {
        if (!this.descriptors.length) {
            return;
        }
        return this.descriptors.find((descriptor: T) => {
            return descriptor.udid === udid;
        });
    }

    public destroy(): void {
        super.destroy();
        const holder = document.getElementById(BaseDeviceTracker.HOLDER_ELEMENT_ID);
        if (holder && holder.parentElement) {
            holder.parentElement.removeChild(holder);
        }
    }
}
