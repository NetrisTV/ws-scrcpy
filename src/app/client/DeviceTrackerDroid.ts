import { BaseDeviceTracker } from './BaseDeviceTracker';
import { ACTION, SERVER_PORT } from '../../server/Constants';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import querystring from 'querystring';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { DeviceTrackerCommand } from '../../common/DeviceTrackerCommand';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import SvgImage from '../ui/SvgImage';

type Column = { title: string };
type Field = string | ((descriptor: DroidDeviceDescriptor) => string);
type DescriptionColumn = { title: string; field: Field };

const DESC_COLUMNS: DescriptionColumn[] = [
    {
        title: 'Name',
        field: (descriptor: DroidDeviceDescriptor) => {
            const manufacturer = descriptor['ro.product.manufacturer'];
            const model = descriptor['ro.product.model'];
            return `${manufacturer} ${model}`;
        },
    },
    {
        title: 'Version',
        field: (descriptor: DroidDeviceDescriptor) => {
            return `${descriptor['ro.build.version.release']} [${descriptor['ro.build.version.sdk']}]`;
        },
    },
    {
        title: 'Serial',
        field: 'udid',
    },
    {
        title: 'State',
        field: 'state',
    },
    {
        title: 'Net Interface',
        field: 'interfaces',
    },
    {
        title: 'Server PID',
        field: 'pid',
    },
];

const ACTION_COLUMNS: Column[] = [
    {
        title: 'Stream',
    },
    {
        title: 'DevTools',
    },
    {
        title: 'Shell',
    },
];

const AttributePlayerName = 'data-player-name';
const AttributePrefixPlayerFor = 'player_for_';

export class DeviceTrackerDroid extends BaseDeviceTracker<DroidDeviceDescriptor, never> {
    public static ACTION = ACTION.DEVICE_LIST;
    public static CREATE_DIRECT_LINKS = true;

    public static start(): DeviceTrackerDroid {
        return new DeviceTrackerDroid(this.ACTION);
    }

    constructor(action: string) {
        super(action);
    }

    protected onSocketOpen(): void {
        // if (this.hasConnection()) {
        //     this.ws.send(JSON.stringify({ command: 'list' }));
        // }
    }

    onInterfaceSelected = (e: Event): void => {
        const selectElement = e.currentTarget as HTMLSelectElement;
        this.updateLink(selectElement, true);
    };

    private updateLink(selectElement: HTMLSelectElement, store: boolean): void {
        const option = selectElement.selectedOptions[0];
        const port = option.getAttribute('data-port') || SERVER_PORT.toString(10);
        const query = option.getAttribute('data-query') || undefined;
        const name = option.getAttribute('data-name');
        const ip = option.value;
        const escapedUdid = selectElement.getAttribute('data-escaped-udid');
        const udid = selectElement.getAttribute('data-udid');
        const playerTds = document.getElementsByName(`${AttributePrefixPlayerFor}${escapedUdid}`);
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
            const player = item.getAttribute(AttributePlayerName);
            if (!player) {
                return;
            }
            const q: ScrcpyStreamParams = {
                action,
                udid,
                player,
                ip,
                port,
            };
            if (query) {
                q.query = query;
            }
            const link = BaseDeviceTracker.buildLink(q, 'stream');
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

    onConfigureStreamClick = (e: MouseEvent): void => {
        const button = e.currentTarget as HTMLButtonElement;
        const udid = button.getAttribute('data-udid');
        console.log(`onConfigureStreamClick: ${udid}`);
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

    private appendTh(title: string, headRow: HTMLTableRowElement): void {
        const th = document.createElement('th');
        th.innerText = title;
        th.className = DeviceTrackerDroid.titleToClassName(title);
        headRow.appendChild(th);
    }

    protected buildTableHead(): HTMLTableSectionElement {
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        DESC_COLUMNS.forEach((item) => {
            this.appendTh(item.title, headRow);
        });
        if (DeviceTrackerDroid.CREATE_DIRECT_LINKS) {
            StreamClientScrcpy.getPlayers().forEach((value) => {
                this.appendTh(value.decoderName, headRow);
            });
        }
        ACTION_COLUMNS.forEach((item) => {
            this.appendTh(item.title, headRow);
        });
        thead.appendChild(headRow);
        return thead;
    }

    protected buildDeviceTable(): void {
        const data = this.descriptors;
        const devices = this.getOrCreateTableHolder();
        const tbody = this.getOrBuildTableBody(devices);

        data.forEach((device) => {
            const row = document.createElement('tr');
            const escapedUdid = this.escapeUdid(device.udid);
            const isActive = device.state === 'device';
            const localStorageKey = DeviceTrackerDroid.getLocalStorageKey(escapedUdid);
            const lastSelected = localStorage && localStorage.getItem(localStorageKey);
            row.id = `device_row_${escapedUdid}`;
            if (!isActive) {
                row.className = 'not-active';
            } else {
                row.className = 'active';
            }
            let hasPid = false;
            let selectInterface: HTMLSelectElement | undefined;
            DESC_COLUMNS.forEach((item) => {
                const { title } = item;
                const fieldName = item.field;
                let value: string;
                if (typeof item.field === 'string') {
                    value = '' + device[item.field as keyof DroidDeviceDescriptor];
                } else {
                    value = item.field(device);
                }
                const td = document.createElement('td');
                td.className = DeviceTrackerDroid.titleToClassName(title);
                row.appendChild(td);
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
                const name = `${AttributePrefixPlayerFor}${escapedUdid}`;
                StreamClientScrcpy.getPlayers().forEach((playerClass) => {
                    const { decoderName } = playerClass;
                    const playerTd = document.createElement('td');
                    playerTd.setAttribute('name', name);
                    playerTd.setAttribute(AttributePlayerName, decoderName);
                    row.appendChild(playerTd);
                });
            }

            const streamTd = document.createElement('td');
            streamTd.className = DeviceTrackerDroid.titleToClassName('Stream');
            if (isActive) {
                const configButton = document.createElement('button');
                configButton.className = 'action-button configure-stream-button active';
                configButton.title = `Configure stream`;
                configButton.appendChild(SvgImage.create(SvgImage.Icon.SETTINGS));
                configButton.setAttribute('data-udid', device.udid);
                configButton.setAttribute('data-command', DeviceTrackerCommand.CONFIGURE_STREAM);
                configButton.onclick = this.onConfigureStreamClick;
                streamTd.appendChild(configButton);
            }
            row.appendChild(streamTd);

            const devtoolsTd = document.createElement('td');
            devtoolsTd.className = DeviceTrackerDroid.titleToClassName('DevTools');
            if (isActive) {
                devtoolsTd.appendChild(
                    BaseDeviceTracker.buildLink(
                        {
                            action: ACTION.DEVTOOLS,
                            udid: device.udid,
                        },
                        'devtools',
                    ),
                );
            }
            row.appendChild(devtoolsTd);

            const shellTd = document.createElement('td');
            shellTd.className = DeviceTrackerDroid.titleToClassName('Shell');
            if (isActive) {
                shellTd.appendChild(
                    BaseDeviceTracker.buildLink(
                        {
                            action: ACTION.SHELL,
                            udid: device.udid,
                        },
                        'shell',
                    ),
                );
            }
            row.appendChild(shellTd);
            tbody.appendChild(row);
            if (hasPid && selectInterface) {
                this.updateLink(selectInterface, false);
            }
        });
    }
}
