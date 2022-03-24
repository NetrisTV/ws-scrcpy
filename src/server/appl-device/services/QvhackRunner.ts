import * as portfinder from 'portfinder';
import { ProcessRunner, ProcessRunnerEvents } from '../../services/ProcessRunner';

export class QvhackRunner extends ProcessRunner<ProcessRunnerEvents> {
    private static instances: Map<string, QvhackRunner> = new Map();
    public static SHUTDOWN_TIMEOUT = 15000;
    public static getInstance(udid: string): QvhackRunner {
        let instance = this.instances.get(udid);
        if (!instance) {
            instance = new QvhackRunner(udid);
            this.instances.set(udid, instance);
            instance.start();
        }
        instance.lock();
        return instance;
    }
    protected TAG = '[QvhackRunner]';
    protected name: string;
    protected cmd = 'ws-qvh';
    protected releaseTimeoutId?: NodeJS.Timeout;
    protected address = '';
    protected started = false;
    private holders = 0;

    constructor(private readonly udid: string) {
        super();
        this.name = `${this.TAG}[udid: ${this.udid}]`;
    }

    public getWebSocketAddress(): string {
        return this.address;
    }

    protected lock(): void {
        if (this.releaseTimeoutId) {
            clearTimeout(this.releaseTimeoutId);
        }
        this.holders++;
    }

    protected unlock(): void {
        this.holders--;
        if (this.holders > 0) {
            return;
        }
        this.releaseTimeoutId = setTimeout(() => {
            super.release();
            QvhackRunner.instances.delete(this.udid);
        }, QvhackRunner.SHUTDOWN_TIMEOUT);
    }

    protected async getArgs(): Promise<string[]> {
        const port = await portfinder.getPortPromise();
        const host = `127.0.0.1:${port}`;
        this.address = `ws://${host}/ws?stream=${encodeURIComponent(this.udid)}`;
        return [host];
    }

    public async start(): Promise<void> {
        return this.runProcess()
            .then(() => {
                // Wait for server to start listen on a port
                this.once('stderr', () => {
                    this.started = true;
                    this.emit('started', true);
                });
            })
            .catch((e) => {
                console.error(this.name, e.message);
            });
    }

    public isStarted(): boolean {
        return this.started;
    }

    public release(): void {
        this.unlock();
    }
}
