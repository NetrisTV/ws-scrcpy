import { DeviceTrackerClient, MapItem } from './DeviceTrackerClient';
import { ACTION, SERVER_PORT } from '../../server/Constants';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import querystring from 'querystring';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { DeviceTrackerCommand } from '../../common/DeviceTrackerCommand';

const FIELDS_MAP: MapItem<DroidDeviceDescriptor>[] = [
    {
        field: 'product.manufacturer',
        title: 'Manufacturer',
    },
    {
        field: 'product.model',
        title: 'Model',
    },
    {
        field: 'build.version.release',
        title: 'Release',
    },
    {
        field: 'build.version.sdk',
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

type Decoders = 'broadway' | 'mse' | 'tinyh264';

const DECODERS: Decoders[] = ['broadway', 'mse', 'tinyh264'];

export class DroidDeviceTrackerClient extends DeviceTrackerClient<DroidDeviceDescriptor, never> {
    public static ACTION = ACTION.DEVICE_LIST;

    public static start(): DroidDeviceTrackerClient {
        return new DroidDeviceTrackerClient(this.ACTION);
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
        const decoderTds = document.getElementsByName(`decoder_${escapedUdid}`);
        if (typeof udid !== 'string') {
            return;
        }
        if (store) {
            const localStorageKey = DroidDeviceTrackerClient.getLocalStorageKey(escapedUdid || '');
            if (localStorage && name) {
                localStorage.setItem(localStorageKey, name);
            }
        }
        const action = 'stream';
        decoderTds.forEach((item) => {
            item.innerHTML = '';
            const decoder = item.getAttribute('data-decoder-name') as Decoders;
            const q: ScrcpyStreamParams = {
                action,
                udid,
                decoder,
                ip,
                port,
            };
            if (query) {
                q.query = query;
            }
            const link = DeviceTrackerClient.buildLink(q, 'stream');
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

    protected buildDeviceTable(data: DroidDeviceDescriptor[]): void {
        const devices = this.getOrCreateTableHolder();
        const tbody = this.getOrBuildTableBody(devices);

        data.forEach((device) => {
            const row = document.createElement('tr');
            const escapedUdid = this.escapeUdid(device.udid);
            const localStorageKey = DroidDeviceTrackerClient.getLocalStorageKey(escapedUdid);
            const lastSelected = localStorage && localStorage.getItem(localStorageKey);
            row.id = `device_row_${escapedUdid}`;
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
                        actionButton.onclick = this.onActionButtonClick;
                        actionButton.className = 'kill-server-button';
                        actionButton.setAttribute('data-udid', device.udid);
                        actionButton.setAttribute('data-pid', value);
                        let command: string;
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
                        const adbProxyOption = DroidDeviceTrackerClient.createProxyOption(device.udid);
                        if (lastSelected === 'proxy') {
                            adbProxyOption.selected = true;
                        }
                        selectElement.appendChild(adbProxyOption);
                        selectElement.onchange = this.onInterfaceSelected;
                        td.appendChild(selectElement);
                        selectInterface = selectElement;
                    } else {
                        td.innerText = value;
                    }
                }
            });
            const isActive = device.state === 'device';
            const name = `decoder_${escapedUdid}`;
            DECODERS.forEach((decoderName) => {
                const decoderTd = document.createElement('td');
                decoderTd.setAttribute('name', name);
                decoderTd.setAttribute('data-decoder-name', decoderName);
                row.appendChild(decoderTd);
            });

            const devtoolsTd = document.createElement('td');
            if (isActive) {
                devtoolsTd.appendChild(
                    DeviceTrackerClient.buildLink(
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
                    DeviceTrackerClient.buildLink(
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
            if (isActive && hasPid && selectInterface) {
                this.updateLink(selectInterface, false);
            }
        });
    }
}
