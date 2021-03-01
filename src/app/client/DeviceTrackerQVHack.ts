import { BaseDeviceTracker, MapItem } from './BaseDeviceTracker';
import QVHackDeviceDescriptor from '../../common/QVHackDeviceDescriptor';
import { StreamClientQVHack } from './StreamClientQVHack';

const SERVER_PORT = 8080;
const SERVER_HOST = location.hostname;

const FIELDS_MAP: MapItem<QVHackDeviceDescriptor>[] = [
    {
        field: 'ProductName',
        title: 'Device Name',
    },
    {
        field: 'ProductType',
        title: 'Type',
    },
    {
        field: 'ProductVersion',
        title: 'Version',
    },
    {
        field: 'Udid',
        title: 'UDID',
    },
    {
        title: 'Stream',
    },
];

const TAG = '[DeviceTrackerQVHack]';

export class DeviceTrackerQVHack extends BaseDeviceTracker<QVHackDeviceDescriptor, never> {
    public static ACTION = 'devicelist';
    protected tableId = 'qvhack_devices_list';
    public static start(): DeviceTrackerQVHack {
        return new DeviceTrackerQVHack(DeviceTrackerQVHack.ACTION);
    }

    constructor(action: string) {
        super(action);
        this.setBodyClass('list');
        this.setTitle('Device list');
    }

    protected onSocketOpen(): void {
        if (this.hasConnection()) {
            (this.ws as WebSocket).send(JSON.stringify({ command: 'list' }));
        }
    }

    protected onSocketClose(e: CloseEvent): void {
        console.log(TAG, `Connection closed: ${e.reason}`);
        setTimeout(() => {
            this.openNewWebSocket();
        }, 2000);
    }

    protected onSocketMessage(e: MessageEvent): void {
        new Response(e.data)
            .text()
            .then((text: string) => {
                this.descriptors = JSON.parse(text) as QVHackDeviceDescriptor[];
                this.buildDeviceTable();
            })
            .catch((error: Error) => {
                console.error(TAG, error.message);
                console.log(TAG, e.data);
            });
    }

    protected buildTableHead(): HTMLTableSectionElement {
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        FIELDS_MAP.forEach((item) => {
            const { title } = item;
            const th = document.createElement('th');
            th.innerText = title;
            th.className = title.toLowerCase();
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        return thead;
    }

    public buildDeviceTable(): void {
        const data = this.descriptors;
        const devices = this.getOrCreateTableHolder();
        const tbody = this.getOrBuildTableBody(devices);

        data.forEach((device) => {
            const row = document.createElement('tr');
            FIELDS_MAP.forEach((item) => {
                if (item.field) {
                    const value = device[item.field].toString();
                    const td = document.createElement('td');
                    td.innerText = value;
                    row.appendChild(td);
                }
            });
            const playerTd = document.createElement('td');
            const link = DeviceTrackerQVHack.buildLink(
                {
                    action: StreamClientQVHack.ACTION,
                    udid: device.Udid,
                    ip: SERVER_HOST,
                    port: SERVER_PORT.toString(10),
                },
                'stream',
            );
            playerTd.appendChild(link);
            row.appendChild(playerTd);

            tbody.appendChild(row);
        });
    }

    protected buildWebSocketUrl(): string {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const host = SERVER_HOST;
        const port = SERVER_PORT;
        const path = '/ws';
        return `${proto}://${host}:${port}${path}`;
    }
}
