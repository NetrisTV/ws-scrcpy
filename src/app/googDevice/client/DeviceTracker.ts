import '../../../style/devicelist.css';
import { BaseDeviceTracker } from '../../client/BaseDeviceTracker';
import { SERVER_PORT } from '../../../common/Constants';
import { ACTION } from '../../../common/Action';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { ShellClient } from './ShellClient';
import { ParamsShell } from '../../../types/ParamsShell';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import SvgImage from '../../ui/SvgImage';
import { html } from '../../ui/HtmlTag';
import Util from '../../Util';
import { Attribute } from '../../Attribute';
import { DeviceState } from '../../../common/DeviceState';
import { Message } from '../../../types/Message';
import { ParamsDeviceTracker } from '../../../types/ParamsDeviceTracker';
import { HostItem } from '../../../types/Configuration';
import { ChannelCode } from '../../../common/ChannelCode';
import { Tool } from '../../client/Tool';
import { ConfigureScrcpy } from './ConfigureScrcpy';
import { ParamsStreamScrcpy } from '../../../types/ParamsStreamScrcpy';
import moment from 'moment';

type Field = keyof GoogDeviceDescriptor | ((descriptor: GoogDeviceDescriptor) => string);
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

export class DeviceTracker extends BaseDeviceTracker<GoogDeviceDescriptor, never> {
    public static readonly ACTION = ACTION.GOOG_DEVICE_LIST;
    public static readonly CREATE_DIRECT_LINKS = true;
    public static configureScrcpy: ConfigureScrcpy;
    private static instancesByUrl: Map<string, DeviceTracker> = new Map();
    protected static tools: Set<Tool> = new Set();
    protected tableId = 'goog_device_list';
    protected static fullName = '';
    private static SelectCodex?: HTMLSelectElement;
    private liveDataWs?: WebSocket;
    private GeneralTab?: HTMLDivElement;
    private AdbShellTab?: HTMLDivElement;
    private AdvancedSettingsTab?: HTMLDivElement;
    private ShellClient?: ShellClient;

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

    private buildLiveDataURL(): URL {
        const { secure, port, hostname } = this.params;
        const protocol = secure ? 'wss:' : 'ws:';
        const proxyPath = location.pathname.slice(0, -1);
        let urlString = `${protocol}//${hostname}${proxyPath || ''}`;
        if (urlString[urlString.length - 1] !== '/') {
            urlString += '/';
        }

        const url = new URL(urlString);
        if (port) {
            url.port = port.toString();
        }
        return url;
    }

    private createLiveDataSocket() {
        this.liveDataWs = new WebSocket(this.buildLiveDataURL().toString() + 'live-data');

        this.liveDataWs.onerror = (e) => {
            console.error('Live data WS error', e);
        };

        this.liveDataWs.onmessage = (event) => {
            // update all changing fields
            const dataObject = JSON.parse(event.data);
            if (dataObject?.type === 'device') {
                Object.keys(dataObject.data)?.forEach((key) => {
                    const element = document.getElementById(key);
                    if (!element) {
                        return;
                    }
                    const value = dataObject.data[key];
                    if (key === 'EmulatorUptime') {
                        const duration = moment.duration(value, 'seconds');
                        const hours = Math.floor(duration.asHours()); // Use asHours for total hours
                        const minutes = duration.minutes();
                        const seconds = duration.seconds();
                        element.textContent = `${hours}h${minutes}m${seconds}s`;
                    } else if (key === 'MemoryUsage') {
                        element.textContent = `${value} Mb`;
                    } else if (key === 'CpuLoadEstimate') {
                        element.textContent = `${value} cores`;
                    }
                });
            }
        };
    }

    protected constructor(params: HostItem, directUrl: string) {
        super({ ...params, action: DeviceTracker.ACTION }, directUrl);
        DeviceTracker.instancesByUrl.set(directUrl, this);
        this.buildDeviceTable();
        this.openNewConnection();
        this.createLiveDataSocket();
    }

    protected onSocketOpen(): void {
        // nothing here;
    }

    protected setIdAndHostName(id: string, hostName: string): void {
        super.setIdAndHostName(id, hostName);
        for (const value of DeviceTracker.instancesByUrl.values()) {
            if (value.id === id && value !== this) {
                console.warn(
                    `Tracker with url: "${this.url}" has the same id(${this.id}) as tracker with url "${value.url}"`,
                );
                console.warn(`This tracker will shut down`);
                this.destroy();
            }
        }
    }

    onInterfaceSelected = (event: Event): void => {
        console.log(event);
        /*
        const selectElement = event.currentTarget as HTMLSelectElement;
        const option = selectElement.selectedOptions[0];
        const url = decodeURI(option.getAttribute(Attribute.URL) || '');
        const name = option.getAttribute(Attribute.NAME) || '';
        const fullName = decodeURIComponent(selectElement.getAttribute(Attribute.FULL_NAME) || '');
        const udid = selectElement.getAttribute(Attribute.UDID) || '';
        this.updateLink({ url, name, fullName, udid, store: true });
        */
    };

    onActionButtonClick = (event: MouseEvent): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const udid = button.getAttribute(Attribute.UDID);
        const pidString = button.getAttribute(Attribute.PID) || '';
        const command = button.getAttribute(Attribute.COMMAND) as string;
        const pid = parseInt(pidString, 10);
        const data: Message = {
            id: this.getNextId(),
            type: command,
            data: {
                udid: typeof udid === 'string' ? udid : undefined,
                pid: isNaN(pid) ? undefined : pid,
            },
        };

        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    };

    private static getLocalStorageKey(udid: string): string {
        return `device_list::${udid}::interface`;
    }

    protected static createUrl(params: ParamsDeviceTracker, udid = ''): URL {
        const secure = !!params.secure;
        const hostname = params.hostname || location.hostname;
        const port = typeof params.port === 'number' ? params.port : secure ? 443 : 80;
        const urlObject = this.buildUrl({ ...params, secure, hostname, port });
        if (udid) {
            urlObject.searchParams.set('action', ACTION.PROXY_ADB);
            urlObject.searchParams.set('remote', `tcp:${SERVER_PORT.toString(10)}`);
            urlObject.searchParams.set('udid', udid);
        }
        return urlObject;
    }

    protected static createInterfaceOption(name: string, url: string): HTMLOptionElement {
        const optionElement = document.createElement('option');
        optionElement.setAttribute(Attribute.URL, url);
        optionElement.setAttribute(Attribute.NAME, name);
        optionElement.innerText = `proxy over adb`;
        return optionElement;
    }

    private static titleToClassName(title: string): string {
        return title.toLowerCase().replace(/\s/g, '_');
    }

    protected buildEmulatorScreen(device: GoogDeviceDescriptor): void {
        const { secure, hostname, port, useProxy } = this.params;
        if (!hostname || !port) {
            return;
        }
        const tracker = DeviceTracker.getInstance({
            type: 'android',
            secure: secure || false,
            hostname,
            port,
            useProxy,
        });

        const descriptor = tracker.getDescriptorByUdid(device.udid);
        if (!descriptor) {
            return;
        }
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const elements = document.getElementsByName(`${DeviceTracker.AttributePrefixInterfaceSelectFor}${fullName}`);
        if (!elements || !elements.length) {
            return;
        }
        const select = elements[0] as HTMLSelectElement;
        const optionElement = select.options[select.selectedIndex];
        const ws = optionElement.getAttribute(Attribute.URL);
        const name = optionElement.getAttribute(Attribute.NAME);
        if (!ws || !name) {
            return;
        }
        const options: ParamsStreamScrcpy = {
            udid: device.udid,
            ws,
            player: '',
            action: ACTION.STREAM_SCRCPY,
            secure,
            hostname,
            port,
            useProxy,
        };
        DeviceTracker.configureScrcpy = new ConfigureScrcpy(tracker, descriptor, options);
        const player = DeviceTracker.configureScrcpy.getPlayer();
        if (!DeviceTracker.SelectCodex) {
            return;
        }

        for (let i = 0; i < DeviceTracker.SelectCodex.options.length; i++) {
            const attr = decodeURIComponent(
                DeviceTracker.SelectCodex.options[i].getAttribute(DeviceTracker.AttributePlayerFullName) || '',
            );
            if (attr == player?.playerFullName) {
                DeviceTracker.SelectCodex.selectedIndex = i;
                break;
            }
        }
    }

    private buildAdvancedSettingsTab(device: GoogDeviceDescriptor): void {
        const blockClass = 'desc-block';
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const streamingSettingsId = `device_streaming_settings_${fullName}`;

        const divHtml = html`
            <div class="device-sub-header">Streaming settings</div>
            <hr class="full-line" />
            <div id="${streamingSettingsId}" class="streaming_settings"></div>
        `.content;

        const streamingSettings = divHtml.getElementById(streamingSettingsId);
        if (!streamingSettings) {
            return;
        }
        const streamEntry = StreamClientScrcpy.createEntryForDeviceList(device, blockClass, fullName, this.params);
        if (streamEntry) {
            streamingSettings.appendChild(streamEntry);
        }

        if (DeviceTracker.CREATE_DIRECT_LINKS) {
            const name = `${DeviceTracker.AttributePrefixPlayerFor}${fullName}`;
            const parentSelect = document.createElement('div');
            const select = document.createElement('select');
            select.classList.add('select-encoder', blockClass);
            select.setAttribute('name', name);
            parentSelect.textContent = 'Selected codex: \u00A0';
            parentSelect.classList.add('codex-select', 'button-label');
            parentSelect.appendChild(select);
            DeviceTracker.SelectCodex = select;
            const players = StreamClientScrcpy.getPlayers();
            for (let i = 0; i < players.length; i++) {
                const playerClass = players[i];
                const { playerCodeName, playerFullName } = playerClass;

                const option = document.createElement('option');
                option.value = playerCodeName;
                if (playerFullName.includes('Broadway')) {
                    option.textContent = playerFullName + ' (Recommended)';
                } else {
                    option.textContent = playerFullName;
                }

                option.setAttribute(DeviceTracker.AttributePlayerFullName, encodeURIComponent(playerFullName));
                option.setAttribute(DeviceTracker.AttributePlayerCodeName, encodeURIComponent(playerCodeName));
                select.appendChild(option);
            }
            // Add the onchange event listener
            select.addEventListener('change', function () {
                const player = decodeURIComponent(
                    this.options[this.selectedIndex].getAttribute(DeviceTracker.AttributePlayerFullName) || '',
                );
                DeviceTracker.configureScrcpy.changePlayer(player);
            });
            streamingSettings.appendChild(parentSelect);
        }

        const div = document.createElement('div');
        div.appendChild(divHtml);
        this.AdvancedSettingsTab = div;
    }

    private buildGeneralTab(device: GoogDeviceDescriptor): void {
        const blockClass = 'desc-block';
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const servicesId = `device_services_${fullName}`;

        const divHtml = html`<div class="device-sub-header">Quick actions</div>
            <hr class="full-line" />
            <div id="${servicesId}" class="services"></div>
            <div class="device-sub-header">Emulator information</div>
            <hr class="full-line" />
            <div class="device-information">
                <div class="device-property">
                    Manufacturer:
                    <span class="device-value">${device['ro.product.manufacturer']}</span>
                </div>
                <div class="device-property">
                    Product model:
                    <span class="device-value">${device['ro.product.model']}</span>
                </div>
                <div class="device-property">
                    Build version release:
                    <span class="device-value">${device['ro.build.version.release']}</span>
                </div>
                <div class="device-property">
                    SDK version:
                    <span class="device-value">${device['ro.build.version.sdk']}</span>
                </div>
                <div class="device-property">
                    Uptime:
                    <span class="device-value" id="EmulatorUptime">${device['emulator.uptime']}</span>
                </div>
                <div class="device-property">
                    Memory usage:
                    <span class="device-value" id="MemoryUsage"></span>
                </div>
                <div class="device-property">
                    CPU load (estimate):
                    <span class="device-value" id="CpuLoadEstimate"></span>
                </div>
            </div>`.content;
        const services = divHtml.getElementById(servicesId);
        if (!services) {
            return;
        }
        DeviceTracker.tools.forEach((tool) => {
            const entry = tool.createEntryForDeviceList(device, blockClass, this.params);
            if (entry) {
                if (Array.isArray(entry)) {
                    entry.forEach((item) => {
                        item && services.appendChild(item);
                    });
                } else {
                    services.appendChild(entry);
                }
            }
        });

        const div = document.createElement('div');
        div.appendChild(divHtml);
        this.GeneralTab = div;
    }

    private buildShellTab(device: GoogDeviceDescriptor): void {
        this.AdbShellTab = document.createElement('div');
        this.AdbShellTab.id = 'main-terminal-container';
        const params: ParamsShell = {
            udid: device.udid,
            action: ACTION.SHELL,
            htmlElementToAppend: this.AdbShellTab,
        };
        this.ShellClient = ShellClient.start(params);
    }

    protected buildDeviceRow(tbody: Element, device: GoogDeviceDescriptor): void {
        const isActive = device.state === DeviceState.DEVICE;
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const blockClass = 'desc-block';
        let selectedInterfaceName = '';
        let hasPid = false;
        let row = html``.content;
        if (!isActive) {
            row = html`<div class="device ${isActive ? 'active' : 'not-active'}">
                <div class="device-stats">
                    <hr class="full-line" />
                    <h2>Emulator Authentication Issue</h2>
                    <p>Your emulator is not authenticated against the server.</p>
                    <p>Please try <strong>restarting the emulator instance</strong>.</p>
                </div>
            </div>`.content;
        } else {
            row = html`<div class="tabs">
                    <button class="tab" id="generalTab">General</button>
                    <button class="tab" id="adbShellTab">ADB Shell</button>
                    <button class="tab" id="advancedSettingsTab">Advanced settings</button>
                </div>
                <div class="tab-content" id="adbShellContent"></div>
                <div class="device ${isActive ? 'active' : 'not-active'}">
                    <div class="device-stats">
                        <div class="tab-content" id="generalTabContent"></div>
                        <div class="tab-content" id="advancedSettingsContent"></div>
                        <div id="interfaces"></div>
                    </div>
                </div>`.content;
        }

        const interfacesDiv = row.getElementById('interfaces');
        if (!interfacesDiv) {
            return;
        }

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
            td.classList.add(DeviceTracker.titleToClassName(title), blockClass);
            if (fieldName !== 'pid') {
                interfacesDiv.appendChild(td);
            }

            if (fieldName === 'pid') {
                hasPid = value !== '-1';
                const actionButton = document.createElement('button');
                actionButton.className = 'action-button kill-server-button';
                actionButton.setAttribute(Attribute.UDID, device.udid);
                actionButton.setAttribute(Attribute.PID, value);
                let command: string;
                if (true) {
                    actionButton.classList.add('active');
                    actionButton.onclick = this.onActionButtonClick;
                    if (hasPid) {
                        command = ControlCenterCommand.KILL_SERVER;
                        actionButton.title = 'Kill server';
                        actionButton.appendChild(SvgImage.create(SvgImage.Icon.CANCEL));
                    } else {
                        command = ControlCenterCommand.START_SERVER;
                        actionButton.title = 'Start server';
                        actionButton.appendChild(SvgImage.create(SvgImage.Icon.REFRESH));
                    }
                    actionButton.setAttribute(Attribute.COMMAND, command);
                } else {
                    const timestamp = device['last.update.timestamp'];
                    if (timestamp) {
                        const date = new Date(timestamp);
                        actionButton.title = `Last update on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
                    } else {
                        actionButton.title = `Not active`;
                    }
                    actionButton.appendChild(SvgImage.create(SvgImage.Icon.OFFLINE));
                }
                const span = document.createElement('span');
                span.innerText = `${actionButton.title} (pid=${value})`;
                actionButton.appendChild(span);
                td.appendChild(actionButton);
            } else if (fieldName === 'interfaces') {
                const proxyInterfaceUrl = DeviceTracker.createUrl(this.params, device.udid).toString();
                const proxyInterfaceName = 'proxy';
                const localStorageKey = DeviceTracker.getLocalStorageKey(fullName);
                const lastSelected = localStorage && localStorage.getItem(localStorageKey);
                const selectElement = document.createElement('select');
                selectElement.setAttribute(Attribute.UDID, device.udid);
                selectElement.setAttribute(Attribute.FULL_NAME, fullName);
                selectElement.setAttribute(
                    'name',
                    encodeURIComponent(`${DeviceTracker.AttributePrefixInterfaceSelectFor}${fullName}`),
                );
                /// #if SCRCPY_LISTENS_ON_ALL_INTERFACES
                device.interfaces.forEach((value) => {
                    const params = {
                        ...this.params,
                        secure: false,
                        hostname: value.ipv4,
                        port: SERVER_PORT,
                    };
                    const url = DeviceTracker.createUrl(params).toString();
                    const optionElement = DeviceTracker.createInterfaceOption(value.name, url);
                    optionElement.innerText = `${value.name}: ${value.ipv4}`;
                    selectElement.appendChild(optionElement);
                    if (lastSelected) {
                        if (lastSelected === value.name || !selectedInterfaceName) {
                            optionElement.selected = true;
                            selectedInterfaceName = value.name;
                        }
                    } else if (device['wifi.interface'] === value.name) {
                        optionElement.selected = true;
                    }
                });
                /// #else
                selectedInterfaceName = proxyInterfaceName;
                td.classList.add('hidden');
                /// #endif
                if (isActive) {
                    const adbProxyOption = DeviceTracker.createInterfaceOption(proxyInterfaceName, proxyInterfaceUrl);
                    if (lastSelected === proxyInterfaceName || !selectedInterfaceName) {
                        adbProxyOption.selected = true;
                        selectedInterfaceName = proxyInterfaceName;
                    }
                    selectElement.appendChild(adbProxyOption);
                    const actionButton = document.createElement('button');
                    actionButton.className = 'action-button update-interfaces-button active';
                    actionButton.title = `Update information`;
                    actionButton.appendChild(SvgImage.create(SvgImage.Icon.REFRESH));
                    actionButton.setAttribute(Attribute.UDID, device.udid);
                    actionButton.setAttribute(Attribute.COMMAND, ControlCenterCommand.UPDATE_INTERFACES);
                    actionButton.onclick = this.onActionButtonClick;
                    td.appendChild(actionButton);
                }
                selectElement.onchange = this.onInterfaceSelected;
                td.appendChild(selectElement);
            } else {
                td.innerText = value;
            }
        });

        this.buildGeneralTab(device);
        this.buildAdvancedSettingsTab(device);
        this.buildShellTab(device);

        tbody.appendChild(row);
        this.buildEmulatorScreen(device);

        const onClick = (contentId: string, tabId: string) => {
            const tabcontents = document.getElementsByClassName('tab-content');
            for (let i = 0; i < tabcontents.length; i++) {
                const tabContent = tabcontents[i] as HTMLElement;
                tabContent.style.display = 'none';
            }

            const allTabs = document.getElementsByClassName('tab');
            for (let i = 0; i < allTabs.length; i++) {
                const tab = allTabs[i] as HTMLElement;
                tab.className = tab.className.replace(' active', '');
            }

            const tab = document.getElementById(tabId) as HTMLElement;
            if (tab) {
                tab.className += ' active';
            }

            const content = document.getElementById(contentId) as HTMLElement;
            if (content) {
                content.style.display = 'block';
            }
        };

        const generalTabContent = document.getElementById('generalTabContent');
        if (generalTabContent && this.GeneralTab) {
            generalTabContent.innerHTML = '';
            generalTabContent.appendChild(this.GeneralTab);

            const generalButton = document.getElementById('generalTab');
            if (generalButton) {
                generalButton.onclick = () => onClick('generalTabContent', 'generalTab');
            }
        }

        const AdbShellContent = document.getElementById('adbShellContent');
        if (AdbShellContent && this.AdbShellTab) {
            AdbShellContent.innerHTML = '';
            AdbShellContent.appendChild(this.AdbShellTab);

            const AdbShellButton = document.getElementById('adbShellTab');
            if (AdbShellButton) {
                AdbShellButton.onclick = () => {
                    onClick('adbShellContent', 'adbShellTab');
                    setTimeout(() => this.ShellClient?.updateTerminalSize(), 500);
                };
            }
        }

        const AdvancedSettingsContent = document.getElementById('advancedSettingsContent');
        if (AdvancedSettingsContent && this.AdvancedSettingsTab) {
            AdvancedSettingsContent.innerHTML = '';
            AdvancedSettingsContent.appendChild(this.AdvancedSettingsTab);

            const AdvancedSettingsButton = document.getElementById('advancedSettingsTab');
            if (AdvancedSettingsButton) {
                AdvancedSettingsButton.onclick = () => onClick('advancedSettingsContent', 'advancedSettingsTab');
            }
        }

        // open general tab by default
        onClick('generalTabContent', 'generalTab');
    }

    protected getChannelCode(): string {
        return ChannelCode.GTRC;
    }

    public destroy(): void {
        super.destroy();
        DeviceTracker.instancesByUrl.delete(this.url.toString());
        if (!DeviceTracker.instancesByUrl.size) {
            const holder = document.getElementById(BaseDeviceTracker.HOLDER_ELEMENT_ID);
            if (holder && holder.parentElement) {
                holder.parentElement.removeChild(holder);
            }
        }
    }
}
