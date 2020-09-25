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
        field: 'ip',
        title: 'Wi-Fi IP',
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

export class DroidDeviceTrackerClient extends DeviceTrackerClient<DroidDeviceDescriptor> {
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

    protected buildDeviceTable(data: DroidDeviceDescriptor[]): void {
        let devices = document.getElementById('devices');
        if (!devices) {
            devices = document.createElement('div');
            devices.id = 'devices';
            devices.className = 'table-wrapper';
            document.body.appendChild(devices);
        }
        const tbody = this.getOrBuildTableBody(devices);

        data.forEach((device) => {
            const row = document.createElement('tr');
            let hasPid = false;
            let hasIp = false;
            this.rows.forEach((item) => {
                if (item.field) {
                    const value = '' + device[item.field];
                    const td = document.createElement('td');
                    td.innerText = value;
                    row.appendChild(td);
                    if (item.field === 'pid') {
                        hasPid = value !== '-1';
                    } else if (item.field === 'ip') {
                        hasIp = !value.includes('[');
                    }
                }
            });
            const isActive = device.state === 'device';
            DECODERS.forEach((decoderName) => {
                const decoderTd = document.createElement('td');
                if (isActive) {
                    if (hasIp && hasPid) {
                        const link = DeviceTrackerClient.buildLink(
                            {
                                action: 'stream',
                                udid: device.udid,
                                decoder: decoderName,
                                ip: device.ip,
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
