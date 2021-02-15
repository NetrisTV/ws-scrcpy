import '../../style/devicelist.css';
import { BaseDeviceTracker } from './BaseDeviceTracker';
import { ACTION, SERVER_PORT } from '../../server/Constants';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import querystring from 'querystring';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { DeviceTrackerCommand } from '../../common/DeviceTrackerCommand';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import SvgImage from '../ui/SvgImage';
import { html } from '../ui/HtmlTag';
import { DevtoolsClient } from './DevtoolsClient';
import { ShellClient } from './ShellClient';
import Util from '../Util';

type Field = keyof DroidDeviceDescriptor | ((descriptor: DroidDeviceDescriptor) => string);
type DescriptionColumn = { title: string; field: Field };

const DESC_COLUMNS: DescriptionColumn[] = [
    {
        title: 'Net Interface',
        field: 'interfaces',
    },
    {
        title: 'Server PID',
        field: 'pid',
    },
];

export class DeviceTrackerDroid extends BaseDeviceTracker<DroidDeviceDescriptor, never> {
    public static readonly ACTION = ACTION.DEVICE_LIST;
    public static readonly CREATE_DIRECT_LINKS = true;
    public static readonly AttributePrefixInterfaceSelectFor = 'interface_select_for';
    public static readonly AttributePlayerFullName = 'data-player-full-name';
    public static readonly AttributePlayerCodeName = 'data-player-code-name';
    public static readonly AttributePrefixPlayerFor = 'player_for_';
    private static instance?: DeviceTrackerDroid;

    public static start(): DeviceTrackerDroid {
        return this.getInstance();
    }

    public static getInstance(): DeviceTrackerDroid {
        if (!this.instance) {
            this.instance = new DeviceTrackerDroid();
        }
        return this.instance;
    }

    protected constructor() {
        super(DeviceTrackerDroid.ACTION);
    }

    protected onSocketOpen(): void {
        // if (this.hasConnection()) {
        //     this.ws.send(JSON.stringify({ command: 'list' }));
        // }
    }

    protected buildTableHead(): HTMLTableSectionElement {
        throw new Error('Method not implemented.');
    }

    onInterfaceSelected = (e: Event): void => {
        const selectElement = e.currentTarget as HTMLSelectElement;
        DeviceTrackerDroid.updateLink(selectElement, true);
    };

    private static updateLink(selectElement: HTMLSelectElement, store: boolean): void {
        const option = selectElement.selectedOptions[0];
        const port = option.getAttribute('data-port') || SERVER_PORT.toString(10);
        const query = option.getAttribute('data-query') || undefined;
        const name = option.getAttribute('data-name');
        const ip = option.value;
        const escapedUdid = selectElement.getAttribute('data-escaped-udid');
        const udid = selectElement.getAttribute('data-udid');
        const playerTds = document.getElementsByName(`${this.AttributePrefixPlayerFor}${escapedUdid}`);
        if (typeof udid !== 'string') {
            return;
        }
        if (store) {
            const localStorageKey = DeviceTrackerDroid.getLocalStorageKey(escapedUdid || '');
            if (localStorage && name) {
                localStorage.setItem(localStorageKey, name);
            }
        }
        const action = 'stream';
        playerTds.forEach((item) => {
            item.innerHTML = '';
            const playerFullName = item.getAttribute(this.AttributePlayerFullName);
            const playerCodeName = item.getAttribute(this.AttributePlayerCodeName);
            if (!playerFullName || !playerCodeName) {
                return;
            }
            const q: ScrcpyStreamParams = {
                action,
                udid,
                player: decodeURIComponent(playerCodeName),
                ip,
                port,
            };
            if (query) {
                q.query = query;
            }
            const link = BaseDeviceTracker.buildLink(q, decodeURIComponent(playerFullName));
            item.appendChild(link);
        });
    }

    onActionButtonClick = (e: MouseEvent): void => {
        const button = e.currentTarget as HTMLButtonElement;
        const udid = button.getAttribute('data-udid');
        const pidString = button.getAttribute('data-pid') || '';
        const command = button.getAttribute('data-command') as string;
        const pid = parseInt(pidString, 10);
        const data: { command: string; udid?: string; pid?: number } = { command };
        if (typeof udid === 'string') {
            data.udid = udid;
        }
        if (!isNaN(pid)) {
            data.pid = pid;
        }

        if (this.hasConnection()) {
            (this.ws as WebSocket).send(JSON.stringify(data));
        }
    };

    private static getLocalStorageKey(udid: string): string {
        return `device_list::${udid}::interface`;
    }

    private static createProxyOption(udid: string): HTMLOptionElement {
        const optionElement = document.createElement('option');
        const query = querystring.encode({
            action: 'proxy',
            remote: `tcp:${SERVER_PORT.toString(10)}`,
            udid: udid,
        });
        optionElement.setAttribute('data-query', `?${query}`);
        optionElement.setAttribute('data-port', location.port);
        optionElement.setAttribute('data-name', 'proxy');
        optionElement.setAttribute('value', location.hostname);
        optionElement.innerText = `proxy over adb`;
        return optionElement;
    }

    private static titleToClassName(title: string): string {
        return title.toLowerCase().replace(/\s/g, '_');
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
        } else {
            while (tbody.children.length) {
                tbody.removeChild(tbody.children[0]);
            }
        }
        return tbody;
    }

    protected buildDeviceTable(): void {
        const data = this.descriptors;
        const devices = this.getOrCreateTableHolder();
        const tbody = this.getOrBuildTableBody(devices);
        const blockClass = 'desc-block';

        data.forEach((device) => {
            const escapedUdid = Util.escapeUdid(device.udid);
            const isActive = device.state === 'device';
            const localStorageKey = DeviceTrackerDroid.getLocalStorageKey(escapedUdid);
            const lastSelected = localStorage && localStorage.getItem(localStorageKey);
            let hasPid = false;
            let selectInterface: HTMLSelectElement | undefined;
            const servicesId = `device_services_${escapedUdid}`;
            const row = html`<div id="device_row_${escapedUdid}" class="device ${isActive ? 'active' : 'not-active'}">
                <div class="device-header">
                    <div class="device-name">${device['ro.product.manufacturer']} ${device['ro.product.model']}</div>
                    <div class="device-serial">${device.udid}</div>
                    <div class="device-version">
                        <div class="release-version">${device['ro.build.version.release']}</div>
                        <div class="sdk-version">${device['ro.build.version.sdk']}</div>
                    </div>
                    <div class="device-state" title="State: ${device.state}"></div>
                </div>
                <div id="${servicesId}" class="services"></div>
            </div>`.content;
            const services = row.getElementById(servicesId);
            if (!services) {
                return;
            }

            const shellEntry = ShellClient.createEntryForDeviceList(device, blockClass);
            shellEntry && services.appendChild(shellEntry);
            const devtoolsEntry = DevtoolsClient.createEntryForDeviceList(device, blockClass);
            devtoolsEntry && services.appendChild(devtoolsEntry);

            const streamEntry = StreamClientScrcpy.createEntryForDeviceList(device, blockClass);
            streamEntry && services.appendChild(streamEntry);

            DESC_COLUMNS.forEach((item) => {
                const { title } = item;
                const fieldName = item.field;
                let value: string;
                if (typeof item.field === 'string') {
                    value = '' + device[item.field];
                } else {
                    value = item.field(device);
                }
                const td = document.createElement('div');
                td.classList.add(DeviceTrackerDroid.titleToClassName(title), blockClass);
                services.appendChild(td);
                if (fieldName === 'pid') {
                    hasPid = value !== '-1';
                    const actionButton = document.createElement('button');
                    actionButton.className = 'action-button kill-server-button';
                    actionButton.setAttribute('data-udid', device.udid);
                    actionButton.setAttribute('data-pid', value);
                    let command: string;
                    if (isActive) {
                        actionButton.classList.add('active');
                        actionButton.onclick = this.onActionButtonClick;
                        if (hasPid) {
                            command = DeviceTrackerCommand.KILL_SERVER;
                            actionButton.title = 'Kill server';
                            actionButton.appendChild(SvgImage.create(SvgImage.Icon.CANCEL));
                        } else {
                            command = DeviceTrackerCommand.START_SERVER;
                            actionButton.title = 'Start server';
                            actionButton.appendChild(SvgImage.create(SvgImage.Icon.REFRESH));
                        }
                        actionButton.setAttribute('data-command', command);
                    } else {
                        const timestamp = device['last.seen.active.timestamp'];
                        if (timestamp) {
                            const date = new Date(timestamp);
                            actionButton.title = `Last seen on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
                        } else {
                            actionButton.title = `Not active`;
                        }
                        actionButton.appendChild(SvgImage.create(SvgImage.Icon.OFFLINE));
                    }
                    const span = document.createElement('span');
                    span.innerText = value;
                    actionButton.appendChild(span);
                    td.appendChild(actionButton);
                } else if (fieldName === 'interfaces') {
                    const selectElement = document.createElement('select');
                    selectElement.setAttribute('data-udid', device.udid);
                    selectElement.setAttribute('data-escaped-udid', escapedUdid);
                    selectElement.setAttribute(
                        'name',
                        `${DeviceTrackerDroid.AttributePrefixInterfaceSelectFor}${escapedUdid}`,
                    );
                    device[fieldName].forEach((value) => {
                        const optionElement = document.createElement('option');
                        optionElement.setAttribute('data-port', SERVER_PORT.toString(10));
                        optionElement.setAttribute('data-name', value.name);
                        optionElement.setAttribute('value', value.ipv4);
                        optionElement.innerText = `${value.name}: ${value.ipv4}`;
                        selectElement.appendChild(optionElement);
                        if (lastSelected) {
                            if (lastSelected === value.name) {
                                optionElement.selected = true;
                            }
                        } else if (device['wifi.interface'] === value.name) {
                            optionElement.selected = true;
                        }
                    });
                    if (isActive) {
                        const adbProxyOption = DeviceTrackerDroid.createProxyOption(device.udid);
                        if (lastSelected === 'proxy') {
                            adbProxyOption.selected = true;
                        }
                        selectElement.appendChild(adbProxyOption);
                        const actionButton = document.createElement('button');
                        actionButton.className = 'action-button update-interfaces-button active';
                        actionButton.title = `Update information`;
                        actionButton.appendChild(SvgImage.create(SvgImage.Icon.REFRESH));
                        actionButton.setAttribute('data-udid', device.udid);
                        actionButton.setAttribute('data-command', DeviceTrackerCommand.UPDATE_INTERFACES);
                        actionButton.onclick = this.onActionButtonClick;
                        td.appendChild(actionButton);
                    }
                    selectElement.onchange = this.onInterfaceSelected;
                    td.appendChild(selectElement);
                    selectInterface = selectElement;
                } else {
                    td.innerText = value;
                }
            });

            if (DeviceTrackerDroid.CREATE_DIRECT_LINKS) {
                const name = `${DeviceTrackerDroid.AttributePrefixPlayerFor}${escapedUdid}`;
                StreamClientScrcpy.getPlayers().forEach((playerClass) => {
                    const { playerCodeName, playerFullName } = playerClass;
                    const playerTd = document.createElement('div');
                    playerTd.classList.add(blockClass);
                    playerTd.setAttribute('name', encodeURIComponent(name));
                    playerTd.setAttribute(
                        DeviceTrackerDroid.AttributePlayerFullName,
                        encodeURIComponent(playerFullName),
                    );
                    playerTd.setAttribute(
                        DeviceTrackerDroid.AttributePlayerCodeName,
                        encodeURIComponent(playerCodeName),
                    );
                    services.appendChild(playerTd);
                });
            }

            tbody.appendChild(row);
            if (DeviceTrackerDroid.CREATE_DIRECT_LINKS && hasPid && selectInterface) {
                DeviceTrackerDroid.updateLink(selectInterface, false);
            }
        });
    }
}
