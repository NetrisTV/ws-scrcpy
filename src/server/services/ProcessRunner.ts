import { Service } from './Service';
import { TypedEmitter } from '../../common/TypedEmitter';
import { ChildProcessByStdio, spawn } from 'child_process';
import { Readable, Writable } from 'stream';

export interface ProcessRunnerEvents {
    spawned: boolean;
    started: boolean;
    stdout: string;
    stderr: string;
    close: { code: number; signal: string };
    exit: { code: number | null; signal: string | null };
    error: Error;
}

export abstract class ProcessRunner<T extends ProcessRunnerEvents> extends TypedEmitter<T> implements Service {
    protected TAG = '[ProcessRunner]';
    protected name: string;
    protected cmd = '';
    protected spawned = false;
    protected proc?: ChildProcessByStdio<Writable, Readable, Readable>;
    protected constructor() {
        super();
        this.name = `${this.TAG}`;
    }

    protected abstract getArgs(): Promise<string[]>;

    protected async runProcess(): Promise<void> {
        if (!this.cmd) {
            throw new Error('Empty command');
        }
        const args = await this.getArgs();
        this.proc = spawn(this.cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        this.proc.stdout.on('data', (data) => {
            this.emit('stdout', data.toString());
        });

        this.proc.stderr.on('data', (data) => {
            this.emit('stderr', data);
        });

        this.proc.on('spawn', () => {
            this.spawned = true;
            this.emit('spawned', true);
        });

        this.proc.on('exit', (code, signal) => {
            this.emit('exit', { code, signal });
        });

        this.proc.on('error', (error) => {
            console.error(this.name, `failed to spawn process.\n${error.stack}`);
            this.emit('error', error);
        });

        this.proc.on('close', (code, signal) => {
            this.emit('close', { code, signal });
        });
    }

    public getName(): string {
        return this.name;
    }

    public release(): void {
        if (this.proc) {
            this.proc.kill();
            this.proc = undefined;
        }
    }

    public start(): Promise<void> {
        return this.runProcess().catch((e) => {
            console.error(this.name, e.message);
            // throw e;
        });
    }

    public isStarted(): boolean {
        return this.spawned;
    }
}
