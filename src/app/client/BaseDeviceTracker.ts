import * as querystring from 'querystring';
import { ManagerClient } from './ManagerClient';
import { Message } from '../../types/Message';
import { BaseDeviceDescriptor } from '../../types/BaseDeviceDescriptor';
import { DeviceTrackerEvent } from '../../types/DeviceTrackerEvent';
import { DeviceTrackerEventList } from '../../types/DeviceTrackerEventList';
import { HostItem } from '../../types/Configuration';
import Url from 'url';
import { html } from '../ui/HtmlTag';
import { ParsedUrlQueryInput } from 'querystring';

const TAG = '[BaseDeviceTracker]';

export abstract class BaseDeviceTracker<T extends BaseDeviceDescriptor, K> extends ManagerClient<K> {
    public static readonly ACTION_LIST = 'devicelist';
    public static readonly ACTION_DEVICE = 'device';
    public static readonly HOLDER_ELEMENT_ID = 'devices';
    protected title = 'Device list';
    protected tableId = 'droid_device_list';
    protected descriptors: T[] = [];
    protected trackerName = '';
    protected id = '';
    private created = false;
    private messageId = 0;

    public static buildUrl(item: HostItem): string {
        const { secure, port, hostname } = item;
        const protocol = secure ? 'wss:' : 'ws:';
        return Url.format({
            protocol,
            hostname,
            port,
            search: `action=${this.ACTION}`,
            pathname: '/',
            slashes: true,
        });
    }

    protected constructor(action: string) {
        super(action);
        this.setBodyClass('list');
        this.setTitle();
    }

    protected getNextId(): number {
        return ++this.messageId;
    }

    protected buildDeviceTable(): void {
        const data = this.descriptors;
        const devices = this.getOrCreateTableHolder();
        const tbody = this.getOrBuildTableBody(devices);

        const block = this.getOrCreateTrackerBlock(tbody, this.trackerName);
        data.forEach((item) => {
            this.buildDeviceRow(block, item);
        });
    }
    private getOrCreateTrackerBlock(parent: Element, controlCenterName: string): Element {
        const id = `tracker_${this.id}`;
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            parent.appendChild(el);
            this.created = true;
        } else {
            while (el.children.length) {
                el.removeChild(el.children[0]);
            }
        }
        const nameBlockId = `${id}_name`;
        let nameEl = document.getElementById(nameBlockId);
        if (!nameEl) {
            nameEl = document.createElement('div');
            nameEl.id = nameBlockId;
            nameEl.className = 'tracker-name';
        }
        nameEl.innerText = controlCenterName;
        el.insertBefore(nameEl, el.firstChild);
        return el;
    }

    protected abstract buildDeviceRow(tbody: Element, device: T): void;

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

    protected setIdAndHostName(id: string, trackerName: string): void {
        if (this.id === id && this.trackerName === trackerName) {
            return;
        }
        this.removeList();
        this.id = id;
        this.trackerName = trackerName;
    }

    protected removeList(): void {
        const element = document.getElementById(`tracker_${this.id}`);
        if (!element) {
            return;
        }
        const parent = element.parentElement;
        if (!parent) {
            return;
        }
        parent.removeChild(element);
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

    protected getOrBuildTableBody(parent: HTMLElement): Element {
        const className = 'device-list';
        let tbody = document.querySelector(`#devices #${this.tableId}.${className}`) as Element;
        if (!tbody) {
            const fragment = html`<div id="${this.tableId}" class="${className}"></div>`.content;
            parent.appendChild(fragment);
            const last = parent.children.item(parent.children.length - 1);
            if (last) {
                tbody = last;
            }
        }
        return tbody;
    }

    public static buildLink(
        q: ParsedUrlQueryInput,
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

    public destroy(): void {
        super.destroy();
        if (this.created) {
            const el = document.getElementById(`tracker_${this.id}`);
            if (el && el.parentElement) {
                el.parentElement.removeChild(el);
            }
        }
    }
}
