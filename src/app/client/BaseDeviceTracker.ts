import * as querystring from 'querystring';
import { ManagerClient } from './ManagerClient';
import { Message } from '../../types/Message';
import { ShellParams } from '../../types/ShellParams';
import { ScrcpyStreamParams } from '../../types/ScrcpyStreamParams';
import { QVHackStreamParams } from '../../types/QVHackStreamParams';
import { DevtoolsParams } from '../../types/DevtoolsParams';
import { BaseDeviceDescriptor } from '../../types/BaseDeviceDescriptor';
import { DeviceTrackerEvent } from '../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../types/DeviceTrackerEventList';

export type MapItem<T> = {
    field?: keyof T;
    title: string;
};

const TAG = '[BaseDeviceTracker]';

export abstract class BaseDeviceTracker<T extends BaseDeviceDescriptor, K> extends ManagerClient<K> {
    public static readonly ACTION_LIST = 'devicelist';
    public static readonly ACTION_DEVICE = 'device';
    public static readonly HOLDER_ELEMENT_ID = 'devices';
    protected title = 'Device list';
    protected tableId = 'droid_device_list';
    protected descriptors: T[] = [];
    protected hostName = '';
    protected id = '';

    protected constructor(action: string) {
        super(action);
        this.setBodyClass('list');
        this.setTitle();
    }

    protected abstract buildDeviceTable(): void;

    protected onSocketClose(e: CloseEvent): void {
        console.log(TAG, `Connection closed: ${e.reason}`);
        setTimeout(() => {
            this.openNewWebSocket();
        }, 2000);
    }

    protected onSocketMessage(e: MessageEvent): void {
        let message: Message;
        try {
            message = JSON.parse(e.data);
        } catch (error) {
            console.error(TAG, error.message);
            console.log(TAG, e.data);
            return;
        }
        switch (message.type) {
            case BaseDeviceTracker.ACTION_LIST: {
                const event = message.data as DeviceTrackerEventList<T>;
                this.descriptors = event.list;
                this.setIdAndHostName(event.id, event.name);
                this.buildDeviceTable();
                break;
            }
            case BaseDeviceTracker.ACTION_DEVICE: {
                const event = message.data as DeviceTrackerEvent<T>;
                this.setIdAndHostName(event.id, event.name);
                this.updateDescriptor(event.device);
                this.buildDeviceTable();
                break;
            }
            default:
                console.log(TAG, `Unknown message type: ${message.type}`);
        }
    }

    protected setIdAndHostName(id: string, hostName: string): void {
        if (this.id === id && this.hostName === hostName) {
            return;
        }
        this.removeList();
        this.id = id;
        this.hostName = hostName;
    }

    protected removeList(): void {
        throw new Error(`${TAG}. removeList() not implemented`);
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
        url?: { secure: boolean; hostname: string; port: string | number },
    ): HTMLAnchorElement {
        const hash = `#!${querystring.encode(q)}`;
        const a = document.createElement('a');
        if (url) {
            const protocol = url.secure ? 'https' : 'http';
            a.setAttribute('href', `${protocol}://${url.hostname}:${url.port}/${hash}`);
        } else {
            a.setAttribute('href', `${location.origin}${location.pathname}${hash}`);
        }
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
}
