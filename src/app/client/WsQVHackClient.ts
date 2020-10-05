import { ManagerClient } from './ManagerClient';
import QVHackDeviceDescriptor from '../../common/QVHackDeviceDescriptor';
import { MessageRunWda } from '../../common/MessageRunWda';

const SERVER_PORT = 8080;
const SERVER_HOST = location.hostname;

export type WsQVHackClientEvents = {
    'device-list': QVHackDeviceDescriptor[];
    'run-wda': MessageRunWda;
    connected: boolean;
};

export class WsQVHackClient extends ManagerClient<WsQVHackClientEvents> {
    private stopped = false;
    private commands: string[] = [];
    constructor() {
        super();
        this.openNewWebSocket();
    }
    protected onSocketClose(e: CloseEvent): void {
        this.emit('connected', false);
        console.log(`Connection closed: ${e.reason}`);
        if (!this.stopped) {
            setTimeout(() => {
                this.openNewWebSocket();
            }, 2000);
        }
    }

    protected onSocketMessage(e: MessageEvent): void {
        new Response(e.data)
            .text()
            .then((text: string) => {
                const json = JSON.parse(text);
                const type = json['type'];
                switch (type) {
                    case 'qvhack-device-list': {
                        const devices = json['data'] as QVHackDeviceDescriptor[];
                        this.emit('device-list', devices);
                        return;
                    }
                    case 'run-wda': {
                        const response = json as MessageRunWda;
                        this.emit('run-wda', response);
                        return;
                    }
                    default: {
                        throw Error('Unsupported message');
                    }
                }
            })
            .catch((error: Error) => {
                console.error(error.message);
                console.log(e.data);
            });
    }

    protected onSocketOpen(): void {
        this.emit('connected', true);
        while (this.commands.length) {
            const str = this.commands.shift();
            if (str) {
                this.sendCommand(str);
            }
        }
    }

    protected buildWebSocketUrl(): string {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const host = SERVER_HOST;
        const port = SERVER_PORT;
        const path = '/ws';
        return `${proto}://${host}:${port}${path}`;
    }

    private sendCommand(str: string): void {
        if (this.hasConnection()) {
            (this.ws as WebSocket).send(str);
        } else {
            this.commands.push(str);
        }
    }

    public subscribeToDeviceList(listener: (devices: QVHackDeviceDescriptor[]) => void): void {
        this.on('device-list', listener);
        const command = 'list';
        const str = JSON.stringify({ command, subscribe: true });
        this.sendCommand(str);
    }

    public runWebDriverAgent(udid: string): Promise<MessageRunWda> {
        const command = 'run-wda';
        this.sendCommand(JSON.stringify({ command, udid }));
        return new Promise((resolve) => {
            const onResponse = (response: MessageRunWda) => {
                const data = response.data;
                if (data.udid === udid) {
                    this.off(command, onResponse);
                    resolve(response);
                }
            };
            this.on(command, onResponse);
        });
    }

    public stop(): void {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.hasConnection()) {
            (this.ws as WebSocket).close();
        }
    }
}
