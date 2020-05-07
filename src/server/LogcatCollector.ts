// @ts-ignore
import adbkit from 'adbkit';
import { AdbKitClient } from '../common/AdbKit';
import { AdbKitLogcatEntry, AdbKitLogcatReader } from '../common/AdbKitLogcat';
import Timeout = NodeJS.Timeout;

export interface LogcatCollectorEventsListener {
    onError(collector: LogcatCollector, error: Error): void;
    onEnd(collector: LogcatCollector): void;
    onFinish(collector: LogcatCollector): void;
    onEntry(collector: LogcatCollector, entry: AdbKitLogcatEntry): void;
}

export class LogcatCollector {
    private static collectorMap: Map<string, LogcatCollector> = new Map();
    private static readonly RELEASE_TIMEOUT: number = 60 * 1000;

    private readonly cache: AdbKitLogcatEntry[] = [];
    private client: AdbKitClient;
    private reader?: AdbKitLogcatReader;
    private initialized: boolean = false;
    private listeners: Set<LogcatCollectorEventsListener> = new Set();
    private releaseTimeout?: Timeout;

    constructor(private readonly udid: string) {
        this.client = adbkit.createClient() as AdbKitClient;
    }

    public static async getCollector(udid: string): Promise<LogcatCollector> {
        let collector: LogcatCollector | undefined = this.collectorMap.get(udid);
        if (!collector) {
            collector = new LogcatCollector(udid);
            this.collectorMap.set(udid, collector);
        }
        return collector;
    }

    public async init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.reader = await this.client.openLogcat(this.udid);
        this.reader.addListener('error', this.onError);
        this.reader.addListener('end', this.onEnd);
        this.reader.addListener('finish', this.onFinish);
        this.reader.addListener('entry', this.onEntry);
        this.initialized = true;
    }

    private onError = (err: Error): void => {
        for (const listener of this.listeners.values()) {
            listener.onError(this, err);
        }
    };

    private onEnd = (): void => {
        for (const listener of this.listeners.values()) {
            listener.onEnd(this);
        }
    };

    private onFinish = (): void => {
        for (const listener of this.listeners.values()) {
            listener.onFinish(this);
        }
    };

    private onEntry = (entry: AdbKitLogcatEntry): void => {
        this.cache.push(entry);
        for (const listener of this.listeners.values()) {
            listener.onEntry(this, entry);
        }
    };

    public getEntries(): AdbKitLogcatEntry[] {
        return this.cache.slice(0);
    }

    public addEventsListener(listener: LogcatCollectorEventsListener): void {
        this.listeners.add(listener);
        if (this.releaseTimeout) {
            clearTimeout(this.releaseTimeout);
            delete this.releaseTimeout;
        }
    }

    public removeEventsListener(listener: LogcatCollectorEventsListener): void {
        this.listeners.delete(listener);
        if (!this.listeners.size) {
            this.releaseTimeout = setTimeout(this.release.bind(this), LogcatCollector.RELEASE_TIMEOUT);
        }
    }

    public release(): void {
        if (!this.reader) {
            return;
        }
        this.reader.removeListener('error', this.onError);
        this.reader.removeListener('end', this.onEnd);
        this.reader.removeListener('finish', this.onFinish);
        this.reader.removeListener('entry', this.onEntry);
        this.reader.end();
        delete this.reader;
    }
}
