import { ManagerClient } from '../../client/ManagerClient';
import { MessageRunWdaResponse } from '../../../types/MessageRunWdaResponse';
import ApplDeviceDescriptor from '../../../types/ApplDeviceDescriptor';
import { Message } from '../../../types/Message';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ParamsWdaProxy } from '../../../types/ParamsWdaProxy';
import { ParsedUrlQuery } from 'querystring';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';

export type WsQVHackClientEvents = {
    'device-list': ApplDeviceDescriptor[];
    'run-wda': MessageRunWdaResponse;
    device: ApplDeviceDescriptor;
    connected: boolean;
};

const TAG = '[WsQVHackClient]';

export class WsQVHackClient extends ManagerClient<ParamsWdaProxy, WsQVHackClientEvents> {
    private stopped = false;
    private commands: string[] = [];
    private hasSession = false;
    private messageId = 0;
    private wait: Map<number, { resolve: (m: Message) => void; reject: () => void }> = new Map();

    constructor(params: ParamsWdaProxy) {
        super(params);
        this.openNewConnection();
    }

    public parseParameters(params: ParsedUrlQuery): ParamsWdaProxy {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.PROXY_WDA) {
            throw Error('Incorrect action');
        }
        return { ...typedParams, action, udid: Util.parseStringEnv(params.udid) };
    }

    protected buildDirectWebSocketUrl(): URL {
        const localUrl = super.buildDirectWebSocketUrl();
        localUrl.searchParams.set('udid', this.params.udid);
        return localUrl;
    }

    protected onSocketClose(e: CloseEvent): void {
        this.emit('connected', false);
        console.log(TAG, `Connection closed: ${e.reason}`);
        if (!this.stopped) {
            setTimeout(() => {
                this.openNewConnection();
            }, 2000);
        }
    }

    protected onSocketMessage(e: MessageEvent): void {
        new Response(e.data)
            .text()
            .then((text: string) => {
                const json = JSON.parse(text) as Message;
                const type = json['type'];
                const id = json['id'];
                const p = this.wait.get(id);
                if (p) {
                    p.resolve(json);
                    return;
                }
                switch (type) {
                    case 'devicelist':
                        const devices = json['data'] as ApplDeviceDescriptor[];
                        this.emit('device-list', devices);
                        return;
                    case 'device':
                        const device = json['data'] as ApplDeviceDescriptor;
                        this.emit('device', device);
                        return;
                    default:
                        throw Error('Unsupported message');
                }
            })
            .catch((error: Error) => {
                console.error(TAG, error.message);
                console.log(TAG, e.data);
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

    private sendCommand(str: string): void {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.send(str);
        } else {
            this.commands.push(str);
        }
    }

    private getNextId(): number {
        return ++this.messageId;
    }

    public async sendMessage(message: Message): Promise<Message> {
        this.sendCommand(JSON.stringify(message));
        return new Promise<Message>((resolve, reject) => {
            this.wait.set(message.id, { resolve, reject });
        });
    }

    public async runWebDriverAgent(udid: string): Promise<Message> {
        const message: Message = {
            id: this.getNextId(),
            type: ControlCenterCommand.RUN_WDA,
            data: {
                udid,
            },
        };
        const response = await this.sendMessage(message);
        this.hasSession = true;
        return response;
    }

    public async requestWebDriverAgent(method: string, args?: any): Promise<any> {
        if (!this.hasSession) {
            throw Error('No session');
        }
        const message: Message = {
            id: this.getNextId(),
            type: ControlCenterCommand.REQUEST_WDA,
            data: {
                method,
                args,
            },
        };
        return this.sendMessage(message);
    }

    public stop(): void {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.close();
        }
    }
}
