import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { HostItem } from '../../../types/Configuration';
import Url from 'url';
import { ACTION } from '../../../common/Action';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import Util from '../../Util';
import { html } from '../../ui/HtmlTag';
import { DeviceState } from '../../../common/DeviceState';

export class DeviceTracker extends BaseDeviceTracker<ApplDeviceDescriptor, never> {
    public static ACTION = ACTION.APPL_DEVICE_LIST;
    protected tableId = 'appl_devices_list';
    private static instancesByUrl: Map<string, DeviceTracker> = new Map();
    public static start(itemOrUrl: HostItem | string): DeviceTracker {
        if (typeof itemOrUrl === 'string') {
            return this.getInstanceByUrl(itemOrUrl);
        }
        return this.getInstance(itemOrUrl);
    }

    public static getInstanceByUrl(url: string): DeviceTracker {
        let instance = this.instancesByUrl.get(url);
        if (!instance) {
            const parsed = Url.parse(url);
            const secure = parsed.protocol === 'wss';
            const hostname = parsed.hostname || '';
            let { port } = parsed;
            if (!port) {
                port = secure ? '443' : '80';
            }
            instance = new DeviceTracker({ type: 'ios', secure, hostname, port });
            this.instancesByUrl.set(url, instance);
        }
        return instance;
    }

    public static getInstance(item: HostItem): DeviceTracker {
        const url = this.buildUrl(item);
        let instance = this.instancesByUrl.get(url);
        if (!instance) {
            instance = new DeviceTracker(item);
            this.instancesByUrl.set(url, instance);
        }
        return instance;
    }

    private secure: boolean;
    private hostname: string;
    private port: string;
    private readonly url: string;

    constructor(item: HostItem) {
        super(ACTION.APPL_DEVICE_LIST);
        this.secure = item.secure;
        this.hostname = item.hostname;
        this.port = item.port;
        this.url = DeviceTracker.buildUrl(item);
        this.setBodyClass('list');
        this.setTitle('Device list');
        this.openNewWebSocket();
    }

    protected onSocketOpen(): void {
        // do nothing;
    }

    protected buildDeviceRow(tbody: Element, device: ApplDeviceDescriptor): void {
        const blockClass = 'desc-block';
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const isActive = device.state === DeviceState.CONNECTED;
        const servicesId = `device_services_${fullName}`;
        const row = html`<div class="device ${isActive ? 'active' : 'not-active'}">
            <div class="device-header">
                <div class="device-name">"${device.name}"</div>
                <div class="device-model">${device.model}</div>
                <div class="device-serial">${device.udid}</div>
                <div class="device-version">
                    <div class="release-version">${device.version}</div>
                </div>
                <div class="device-state" title="State: ${device.state}"></div>
            </div>
            <div id="${servicesId}" class="services"></div>
        </div>`.content;
        const services = row.getElementById(servicesId);
        if (!services) {
            return;
        }

        const playerTd = document.createElement('div');
        playerTd.className = blockClass;
        const link = DeviceTracker.buildLink(
            {
                action: ACTION.STREAM_WS_QVH,
                udid: device.udid,
            },
            'stream',
            { secure: this.secure, port: this.port, hostname: this.hostname },
        );
        playerTd.appendChild(link);
        services.appendChild(playerTd);
        tbody.appendChild(row);
    }

    protected buildWebSocketUrl(): string {
        return this.url;
    }
}
