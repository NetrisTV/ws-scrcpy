import * as querystring from 'querystring';
import { NodeClient } from './NodeClient';
import { Message } from '../common/Message';
import { Device } from '../common/Device';
import { StreamParams } from './ScrcpyClient';
import { SERVER_PORT } from '../server/Constants';
import { ShellParams } from './ClientShell';

type MapItem = {
    field?: keyof Device;
    title: string;
};

const FIELDS_MAP: MapItem[] = [
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
        field: 'pid',
        title: 'Pid',
    },
    {
        title: 'Broadway',
    },
    {
        title: 'Native',
    },
    {
        title: 'h264bsd',
    },
    {
        title: 'tinyh264',
    },
    {
        title: 'Shell',
    },
];

type Decoders = 'broadway' | 'native' | 'h264bsd' | 'tinyh264';

const DECODERS: Decoders[] = ['broadway', 'native', 'h264bsd', 'tinyh264'];

export class ClientDeviceTracker extends NodeClient {
    public static ACTION = 'devicelist';
    public static start(): ClientDeviceTracker {
        return new ClientDeviceTracker(ClientDeviceTracker.ACTION);
    }

    constructor(action: string) {
        super(action);
        this.setTitle('Device list');
    }

    protected onSocketClose(e: CloseEvent): void {
        console.log(`Connection closed: ${e.reason}`);
        setTimeout(() => {
            this.openNewWebSocket();
        }, 2000);
    }

    protected onSocketMessage(e: MessageEvent): void {
        let message: Message;
        try {
            message = JSON.parse(e.data);
        } catch (error) {
            console.error(error.message);
            console.log(e.data);
            return;
        }
        if (message.type !== ClientDeviceTracker.ACTION) {
            console.log(`Unknown message type: ${message.type}`);
            return;
        }
        const list: Device[] = message.data as Device[];
        this.buildDeviceTable(list);
    }

    private buildDeviceTable(data: Device[]): void {
        let devices = document.getElementById('devices');
        if (!devices) {
            devices = document.createElement('div');
            devices.id = 'devices';
            devices.className = 'table-wrapper';
            document.body.appendChild(devices);
        }
        const id = 'devicesList';
        let tbody = document.querySelector(`#devices table#${id} tbody`) as Element;
        if (!tbody) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');
            FIELDS_MAP.forEach((item) => {
                const { title } = item;
                const td = document.createElement('th');
                td.innerText = title;
                td.className = title.toLowerCase();
                headRow.appendChild(td);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);
            tbody = document.createElement('tbody');
            table.id = id;
            table.appendChild(tbody);
            table.setAttribute('width', '100%');
            devices.appendChild(table);
        } else {
            while (tbody.children.length) {
                tbody.removeChild(tbody.children[0]);
            }
        }

        data.forEach((device) => {
            const row = document.createElement('tr');
            FIELDS_MAP.forEach((item) => {
                if (item.field) {
                    const td = document.createElement('td');
                    td.innerText = device[item.field].toString();
                    row.appendChild(td);
                }
            });
            const isActive = device.state === 'device';
            DECODERS.forEach((decoderName) => {
                const decoderTd = document.createElement('td');
                if (isActive) {
                    decoderTd.appendChild(
                        ClientDeviceTracker.buildLink(
                            {
                                showFps: true,
                                action: 'stream',
                                udid: device.udid,
                                decoder: decoderName,
                                ip: device.ip,
                                port: SERVER_PORT.toString(10),
                            },
                            'stream',
                        ),
                    );
                }
                row.appendChild(decoderTd);
            });

            const shellTd = document.createElement('td');
            if (isActive) {
                shellTd.appendChild(
                    ClientDeviceTracker.buildLink(
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

    private static buildLink(q: StreamParams | ShellParams, text: string): HTMLAnchorElement {
        const hash = `#!${querystring.encode(q)}`;
        const a = document.createElement('a');
        a.setAttribute('href', `${location.origin}${location.pathname}${hash}`);
        a.setAttribute('rel', 'noopener noreferrer');
        a.setAttribute('target', '_blank');
        a.innerText = text;
        return a;
    }
}
