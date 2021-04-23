import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { ACTION } from '../../../common/Action';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import Util from '../../Util';
import { html } from '../../ui/HtmlTag';
import { DeviceState } from '../../../common/DeviceState';
import { ParsedUrlQueryInput } from 'querystring';
import { HostItem } from '../../../types/Configuration';

export class DeviceTracker extends BaseDeviceTracker<ApplDeviceDescriptor, never> {
    public static ACTION = ACTION.APPL_DEVICE_LIST;
    protected tableId = 'appl_devices_list';
    private static instancesByUrl: Map<string, DeviceTracker> = new Map();

    public static start(hostItem: HostItem): DeviceTracker {
        const url = this.buildUrlForTracker(hostItem).toString();
        let instance = this.instancesByUrl.get(url);
        if (!instance) {
            instance = new DeviceTracker(hostItem, url);
        }
        return instance;
    }

    public static getInstance(hostItem: HostItem): DeviceTracker {
        return this.start(hostItem);
    }

    constructor(params: HostItem, directUrl: string) {
        super({ ...params, action: DeviceTracker.ACTION }, directUrl);
        DeviceTracker.instancesByUrl.set(directUrl, this);
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
        const q: ParsedUrlQueryInput = {
            action: ACTION.STREAM_WS_QVH,
            udid: device.udid,
        };
        const link = DeviceTracker.buildLink(q, 'stream', this.params);
        playerTd.appendChild(link);
        services.appendChild(playerTd);
        tbody.appendChild(row);
    }
}
