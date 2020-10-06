import { DeviceTrackerClient, MapItem } from './DeviceTrackerClient';
import { ACTION, SERVER_PORT } from '../../server/Constants';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';

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

    private onInterfaceSelected(e: Event): void {
        const selectElement = e.target as HTMLSelectElement;
        const option = selectElement.selectedOptions[0];
        const ip = option.value;
        const escapedUdid = selectElement.getAttribute('data-escaped-udid');
        const udid = selectElement.getAttribute('data-udid');
        const decoderTds = document.getElementsByName(`decoder_${escapedUdid}`);
        if (typeof udid !== 'string') {
            return;
        }
        decoderTds.forEach(item => {
            item.innerHTML = '';
            const decoderName = item.getAttribute('data-decoder-name') as Decoders;
            const link = DeviceTrackerClient.buildLink(
                {
                    action: 'stream',
                    udid: udid,
                    decoder: decoderName,
                    ip: ip,
                    port: SERVER_PORT.toString(10),
                },
                'stream',
            );
            item.appendChild(link);
        })
    }

    protected buildDeviceTable(data: DroidDeviceDescriptor[]): void {
        const devices = this.getOrCreateTableHolder();
        const tbody = this.getOrBuildTableBody(devices);

        data.forEach((device) => {
            const row = document.createElement('tr');
            const escapedUdid = this.escapeUdid(device.udid);
            row.id = `device_row_${escapedUdid}`;
            let hasPid = false;
            let ip = '';
            this.rows.forEach((item) => {
                if (item.field) {
                    const fieldName = item.field;
                    const value = '' + device[fieldName];
                    const td = document.createElement('td');
                    td.innerText = value;
                    row.appendChild(td);
                    if (fieldName === 'pid') {
                        hasPid = value !== '-1';
                    } else if (fieldName === 'interfaces') {
                        td.innerText = '';
                        const selectElement = document.createElement('select');
                        selectElement.setAttribute('data-udid', device.udid);
                        selectElement.setAttribute('data-escaped-udid', escapedUdid);
                        device[fieldName].forEach(value => {
                            const optionElement = document.createElement('option');
                            optionElement.setAttribute('data-name', value.name);
                            optionElement.setAttribute('value', value.ipv4);
                            optionElement.innerText = `${value.name}: ${value.ipv4}`;
                            selectElement.appendChild(optionElement);
                            if (device['wifi.interface'] === value.name) {
                                optionElement.selected = true;
                                ip = value.ipv4;
                            }
                            if (!ip) {
                                ip = value.ipv4;
                            }
                        });
                        selectElement.onchange = this.onInterfaceSelected;
                        td.appendChild(selectElement);
                    }
                }
            });
            const isActive = device.state === 'device';
            const name = `decoder_${escapedUdid}`;
            DECODERS.forEach((decoderName) => {
                const decoderTd = document.createElement('td');
                decoderTd.setAttribute('name', name);
                decoderTd.setAttribute('data-decoder-name', decoderName);
                if (isActive) {
                    if (ip && hasPid) {
                        const link = DeviceTrackerClient.buildLink(
                            {
                                action: 'stream',
                                udid: device.udid,
                                decoder: decoderName,
                                ip: ip,
                                port: SERVER_PORT.toString(10),
                            },
                            'stream',
                        );
                        decoderTd.appendChild(link);
                    }
                }
                row.appendChild(decoderTd);
            });

            const shellTd = document.createElement('td');
            if (isActive) {
                shellTd.appendChild(
                    DeviceTrackerClient.buildLink(
                        {
                            action: 'shell',
                            udid: device.udid,
                        },
                        'shell',
                    ),
                );
            }
            row.appendChild(shellTd);
            tbody.appendChild(row);
        });
    }
}
