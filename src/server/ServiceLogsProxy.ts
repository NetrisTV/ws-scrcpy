// @ts-ignore
import * as logcat from 'adbkit-logcat';
import { AdbKitLogcatEntry, AdbKitLogcatReaderEvents } from '../common/AdbKitLogcat';
import { Message } from '../common/Message';
import { Filters, LogcatClientMessage } from '../common/LogcatMessage';
import { LogcatCollector, LogcatCollectorEventsListener } from './LogcatCollector';
import WebSocket from 'ws';
import { ReleasableService } from './ReleasableService';
import { LogsFilter, PriorityLevel } from './LogsFilter';

interface ReaderProperties {
    messageId: number;
    udid: string;
    filters: Filters;
}

const DEFAULT_FILTERS: Filters = {
    priority: PriorityLevel.VERBOSE
};

const EVENT_TYPE_LOGCAT = 'logcat';

export class ServiceLogsProxy extends ReleasableService implements LogcatCollectorEventsListener {
    private activeCollectorsMap: Map<string, LogcatCollector> = new Map();
    private collectorProperties: WeakMap<LogcatCollector, ReaderProperties> = new Map();

    constructor(ws: WebSocket) {
        super(ws);
    }

    public static createService(ws: WebSocket): ReleasableService {
        return new ServiceLogsProxy(ws);
    }

    public onError = (collector: LogcatCollector, error: Error): void => {
        this.buildAndSendMessage(collector, 'error', error);
    };
    public onEnd = (collector: LogcatCollector): void => {
        this.buildAndSendMessage(collector, 'end');
    };
    public onFinish = (collector: LogcatCollector): void => {
        this.buildAndSendMessage(collector, 'finish');
    };
    public onEntry = (collector: LogcatCollector, entry: AdbKitLogcatEntry): void => {
        this.buildAndSendMessage(collector, 'entry', entry);
    };

    private buildAndSendMessage(collector: LogcatCollector,
                                type: keyof typeof AdbKitLogcatReaderEvents,
                                event?: AdbKitLogcatEntry | Error): void {
        const properties: ReaderProperties | undefined = this.collectorProperties.get(collector);
        if (!properties) {
            return;
        }
        const msg: Message = {
            id: properties.messageId,
            type: EVENT_TYPE_LOGCAT,
            data: {
                udid: properties.udid,
                type,
                event
            }
        };
        if (type === 'entry' && event && !LogsFilter.filterEvent(properties.filters, event as AdbKitLogcatEntry)) {
            return;
        }
        this.sendMessage(msg);
    }

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        console.log(`Received message: ${event.data}`);
        let data;
        try {
            data = JSON.parse(event.data.toString());
        } catch (e) {
            console.error(e.message);
            return;
        }
        this.handleMessage(data as Message)
            .catch((e: Error) => {
                console.error(e.message);
            });
    }

    private handleMessage = async (message: Message): Promise<void> => {
        if (message.type !== EVENT_TYPE_LOGCAT) {
            return;
        }
        const data: LogcatClientMessage = message.data as LogcatClientMessage;
        const {type, udid} = data;
        if (type === 'start') {
            if (this.activeCollectorsMap.has(udid)) {
                console.error(`Reader for "${udid}" is already active`);
                return;
            }
            const collector = await LogcatCollector.getCollector(udid);
            await collector.init();
            const props: ReaderProperties = {
                udid,
                messageId: message.id,
                filters: DEFAULT_FILTERS
            };
            this.collectorProperties.set(collector, props);
            collector.addEventsListener(this);
            collector.getEntries().forEach(entry => {
                this.onEntry(collector, entry);
            });
            return;
        }
        if (type === 'stop') {
            const collector = this.activeCollectorsMap.get(udid);
            if (!collector) {
                console.error(`Reader for "${udid}" is not active`);
                return;
            }
            collector.removeEventsListener(this);
            this.collectorProperties.delete(collector);
        }
    };

    public release(): void {
        super.release();
        this.activeCollectorsMap.forEach(collector => {
            collector.removeEventsListener(this);
            this.collectorProperties.delete(collector);
        });
        this.activeCollectorsMap.clear();
    }
}
