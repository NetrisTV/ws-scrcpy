import { DeviceTrackerClient, MapItem } from './DeviceTrackerClient';
import QVHackDeviceDescriptor from '../../common/QVHackDeviceDescriptor';
import { QVHackStreamClient } from './QVHackStreamClient';

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

export class QVHackClientDeviceTracker extends DeviceTrackerClient<QVHackDeviceDescriptor, never> {
    public static ACTION = 'devicelist';
    protected tableId = 'qvhack_devices_list';
    public static start(): QVHackClientDeviceTracker {
        return new QVHackClientDeviceTracker(QVHackClientDeviceTracker.ACTION);
    }

    constructor(action: string) {
        super(action, FIELDS_MAP);
        this.setBodyClass('list');
        this.setTitle('Device list');
    }

    protected onSocketOpen(): void {
        if (this.hasConnection()) {
            (this.ws as WebSocket).send(JSON.stringify({ command: 'list' }));
        }
    }

    protected onSocketClose(e: CloseEvent): void {
        console.log(`Connection closed: ${e.reason}`);
        setTimeout(() => {
            this.openNewWebSocket();
        }, 2000);
    }

    protected onSocketMessage(e: MessageEvent): void {
        new Response(e.data)
            .text()
            .then((text: string) => {
                const list: QVHackDeviceDescriptor[] = JSON.parse(text) as QVHackDeviceDescriptor[];
                this.buildDeviceTable(list);
            })
            .catch((error: Error) => {
                console.error(error.message);
                console.log(e.data);
            });
    }

    public buildDeviceTable(data: QVHackDeviceDescriptor[]): void {
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
            const decoderTd = document.createElement('td');
            const link = QVHackClientDeviceTracker.buildLink(
                {
                    action: QVHackStreamClient.ACTION,
                    udid: device.Udid,
                    ip: SERVER_HOST,
                    port: SERVER_PORT.toString(10),
                },
                'stream',
            );
            decoderTd.appendChild(link);
            row.appendChild(decoderTd);

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
