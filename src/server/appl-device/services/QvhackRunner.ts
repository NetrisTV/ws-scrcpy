import * as portfinder from 'portfinder';
import { EnvName } from '../../EnvName';
import { ProcessRunner, ProcessRunnerEvents } from '../../services/ProcessRunner';

export class QvhackRunner extends ProcessRunner<ProcessRunnerEvents> {
    private static instances: Map<string, QvhackRunner> = new Map();
    public static getInstance(udid: string): QvhackRunner {
        let instance = this.instances.get(udid);
        if (!instance) {
            instance = new QvhackRunner(udid);
            this.instances.set(udid, instance);
            instance.start();
        } else {
            if (instance.releaseTimeoutId) {
                clearTimeout(instance.releaseTimeoutId);
            }
        }
        instance.holders++;
        return instance;
    }
    protected TAG = '[QvhackRunner]';
    protected name: string;
    protected cmd: string;
    protected holders = 0;
    protected releaseTimeoutId?: NodeJS.Timeout;
    protected address = '';

    constructor(private readonly udid: string) {
        super();
        this.name = `${this.TAG}[udid: ${this.udid}]`;
        this.cmd = this.getPathFromEnv(EnvName.WS_QVH_PATH);
    }

    public getWebSocketAddress(): string {
        return this.address;
    }

    protected async getArgs(): Promise<string[]> {
        const port = await portfinder.getPortPromise();
        const host = `127.0.0.1:${port}`;
        this.address = `ws://${host}/ws?stream=${encodeURIComponent(this.udid)}`;
        return [host];
    }

    public start(): void {
        this.runProcess()
            .then(() => {
                // FIXME: for some reason `ws-qvh` does not emit `spawn` event
                this.once('stderr', () => {
                    this.spawned = true;
                    this.emit('started', true);
                });
            })
            .catch((e) => {
                console.error(this.name, e.message);
            });
    }

    public release(): void {
        this.holders--;
        if (this.holders > 0) {
            return;
        }
        const TIME = 15000;
        this.releaseTimeoutId = setTimeout(() => {
            super.release();
            QvhackRunner.instances.delete(this.udid);
        }, TIME);
    }
}
