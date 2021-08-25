import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ACTION } from '../../../common/Action';
import { WDARunner } from '../services/WDARunner';
import { MessageRunWdaResponse } from '../../../types/MessageRunWdaResponse';

export class WebDriverAgentProxy extends Mw {
    public static readonly TAG = 'WebDriverAgentProxy';
    protected name: string;
    private wda?: WDARunner;

    public static processRequest(ws: WS, params: RequestParameters): WebDriverAgentProxy | undefined {
        if (params.parsedQuery?.action !== ACTION.PROXY_WDA) {
            return;
        }
        const { parsedQuery } = params;
        const list = parsedQuery.udid;
        if (!list) {
            return;
        }
        const udid = typeof list === 'string' ? list : list[0];
        return new WebDriverAgentProxy(ws, udid);
    }

    constructor(protected ws: WS, private readonly udid: string) {
        super(ws);
        this.name = `[${WebDriverAgentProxy.TAG}][udid: ${this.udid}]`;
    }

    private runWda(command: ControlCenterCommand): void {
        const udid = command.getUdid();
        if (this.wda) {
            const message: MessageRunWdaResponse = {
                id: command.getId(),
                type: 'run-wda',
                data: {
                    udid: udid,
                    code: -1,
                    text: 'WDA already started',
                },
            };
            this.sendMessage(message);
            return;
        }
        this.wda = WDARunner.getInstance(udid);
        if (this.wda.isStarted()) {
            this.onStarted(command);
        } else {
            this.wda.once('started', () => {
                this.onStarted(command);
            });
        }
        this.wda.on('response', this.sendMessage);
    }

    private onStarted = (command: ControlCenterCommand): void => {
        const message: MessageRunWdaResponse = {
            id: command.getId(),
            type: 'run-wda',
            data: {
                udid: command.getUdid(),
                code: 0,
            },
        };
        this.sendMessage(message);
    };

    private requestWda(command: ControlCenterCommand): void {
        if (!this.wda) {
            return;
        }
        this.wda
            .request(command)
            .then((response) => {
                this.sendMessage({
                    id: command.getId(),
                    type: command.getType(),
                    data: {
                        success: true,
                        response,
                    },
                });
            })
            .catch((e) => {
                this.sendMessage({
                    id: command.getId(),
                    type: command.getType(),
                    data: {
                        success: false,
                        error: e.message,
                    },
                });
            });
    }

    protected onSocketMessage(event: WS.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (e) {
            console.error(`[${WebDriverAgentProxy.TAG}], Received message: ${event.data}. Error: ${e.message}`);
            return;
        }
        const type = command.getType();
        switch (type) {
            case ControlCenterCommand.RUN_WDA:
                this.runWda(command);
                break;
            case ControlCenterCommand.REQUEST_WDA:
                this.requestWda(command);
                break;
            default:
                throw new Error(`Unsupported command: "${type}"`);
        }
    }

    public release(): void {
        super.release();
        if (this.wda) {
            this.wda.off('response', this.sendMessage);
            this.wda.release();
        }
    }
}
