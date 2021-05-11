import { ManagerClient } from './ManagerClient';
import { Message } from '../../types/Message';
import { MessageError, MessageHosts, MessageType } from '../../common/HostTrackerMessage';
import { ACTION } from '../../common/Action';
import { DeviceTracker as GoogDeviceTracker } from '../googDevice/client/DeviceTracker';
import { DeviceTracker as ApplDeviceTracker } from '../applDevice/client/DeviceTracker';
import { ParamsBase } from '../../types/ParamsBase';
import { HostItem } from '../../types/Configuration';

const TAG = '[HostTracker]';

export interface HostTrackerEvents {
    hosts: HostItem[];
    disconnected: CloseEvent;
    error: string;
}

export class HostTracker extends ManagerClient<ParamsBase, HostTrackerEvents> {
    private static instance?: HostTracker;

    public static start(): void {
        this.getInstance();
    }

    public static getInstance(): HostTracker {
        if (!this.instance) {
            this.instance = new HostTracker();
        }
        return this.instance;
    }

    private trackers: Array<GoogDeviceTracker | ApplDeviceTracker> = [];

    constructor() {
        super({ action: ACTION.LIST_HOSTS });
        this.openNewWebSocket();
        (this.ws as WebSocket).binaryType = 'arraybuffer';
    }

    protected onSocketClose(ev: CloseEvent): void {
        console.log(TAG, 'WS closed');
        this.emit('disconnected', ev);
    }

    protected onSocketMessage(e: MessageEvent): void {
        let message: Message;
        try {
            message = JSON.parse(e.data);
        } catch (error) {
            console.error(TAG, error.message);
            console.log(TAG, e.data);
            return;
        }
        switch (message.type) {
            case MessageType.ERROR: {
                const msg = message as MessageError;
                console.error(TAG, msg.data);
                this.emit('error', msg.data);
                break;
            }
            case MessageType.HOSTS: {
                const msg = message as MessageHosts;
                this.emit('hosts', msg.data);
                msg.data.forEach((item) => {
                    switch (item.type) {
                        case 'android':
                            this.trackers.push(GoogDeviceTracker.start(item));
                            break;
                        case 'ios':
                            this.trackers.push(ApplDeviceTracker.start(item));
                            break;
                        default:
                            console.warn(TAG, `Unsupported host type: "${item.type}"`);
                    }
                });
                break;
            }
            default:
                console.log(TAG, `Unknown message type: ${message.type}`);
        }
    }

    protected onSocketOpen(): void {
        // do nothing
    }

    public destroy(): void {
        super.destroy();
        this.trackers.forEach((tracker) => {
            tracker.destroy();
        });
        this.trackers.length = 0;
    }
}
