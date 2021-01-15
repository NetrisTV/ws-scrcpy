import { BaseDeviceTracker, MapItem } from './BaseDeviceTracker';
import { ACTION, SERVER_PORT } from '../../server/Constants';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import querystring from 'querystring';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { DeviceTrackerCommand } from '../../common/DeviceTrackerCommand';

const FIELDS_MAP: MapItem<DroidDeviceDescriptor>[] = [
    {
        field: 'ro.product.manufacturer',
        title: 'Manufacturer',
    },
    {
        field: 'ro.product.model',
        title: 'Model',
    },
    {
        field: 'ro.build.version.release',
        title: 'Release',
    },
    {
        field: 'ro.build.version.sdk',
        title: 'SDK',
    },
    {
        field: 'udid',
        title: 'Serial',
    },
    {
        field: 'state',
        title: 'State',
    },
    {
        field: 'interfaces',
        title: 'Net Interface',
    },
    {
        field: 'pid',
        title: 'Pid',
    },
    {
        title: 'Broadway',
    },
    {
        title: 'MSE',
    },
    {
        title: 'tinyh264',
    },
    {
        title: 'devtools',
    },
    {
        title: 'Shell',
    },
];

type Players = 'broadway' | 'mse' | 'tinyh264';

const PLAYERS: Players[] = ['broadway', 'mse', 'tinyh264'];

const AttributePlayerName = 'data-player-name';
const AttributePrefixPlayerFor = 'player_for_';

export class DeviceTrackerDroid extends BaseDeviceTracker<DroidDeviceDescriptor, never> {
    public static ACTION = ACTION.DEVICE_LIST;

    public static start(): DeviceTrackerDroid {
        return new DeviceTrackerDroid(this.ACTION);
    }

    constructor(action: string) {
        super(action, FIELDS_MAP);
    }

    protected onSocketOpen(): void {
        // if (this.hasConnection()) {
        //     this.ws.send(JSON.stringify({ command: 'list' }));
        // }
    }

    onInterfaceSelected = (e: Event): void => {
        const selectElement = e.target as HTMLSelectElement;
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
            const player = item.getAttribute(AttributePlayerName) as Players;
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
        const button = e.target as HTMLButtonElement;
        const udid = button.getAttribute('data-udid');
        const pidString = button.getAttribute('data-pid') || '';
        const command = button.getAttribute('data-command') as string;
        const pid = parseInt(pidString, 10);

        if (this.hasConnection()) {
            (this.ws as WebSocket).send(JSON.stringify({ command, udid, pid }));
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
            }
            let hasPid = false;
            let selectInterface: HTMLSelectElement | undefined;
            this.rows.forEach((item) => {
                if (item.field) {
                    const { title } = item;
                    const fieldName = item.field;
                    const value = '' + device[fieldName];
                    const td = document.createElement('td');
                    td.className = title.toLowerCase();
                    row.appendChild(td);
                    if (fieldName === 'pid') {
                        hasPid = value !== '-1';
                        const actionButton = document.createElement('button');
                        actionButton.className = 'kill-server-button';
                        actionButton.setAttribute('data-udid', device.udid);
                        actionButton.setAttribute('data-pid', value);
                        let command: string;
                        if (isActive) {
                            actionButton.classList.add('active');
                            actionButton.onclick = this.onActionButtonClick;
                            if (hasPid) {
                                command = DeviceTrackerCommand.KILL_SERVER;
                                actionButton.title = 'Kill server';
                                actionButton.innerText = `☠ ${value}`;
                            } else {
                                command = DeviceTrackerCommand.START_SERVER;
                                actionButton.title = 'Start server';
                                actionButton.innerText = `↺ ${value}`;
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
                            actionButton.innerText = `❓ ${value}`;
                        }
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
                        }
                        selectElement.onchange = this.onInterfaceSelected;
                        td.appendChild(selectElement);
                        selectInterface = selectElement;
                    } else {
                        td.innerText = value;
                    }
                }
            });
            const name = `${AttributePrefixPlayerFor}${escapedUdid}`;
            PLAYERS.forEach((playerName) => {
                const playerTd = document.createElement('td');
                playerTd.setAttribute('name', name);
                playerTd.setAttribute(AttributePlayerName, playerName);
                row.appendChild(playerTd);
            });

            const devtoolsTd = document.createElement('td');
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
