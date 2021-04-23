import { Service } from './Service';
import { TypedEmitter } from '../../common/TypedEmitter';
import * as process from 'process';
import { ChildProcessByStdio, spawn } from 'child_process';
import { EnvName } from '../EnvName';
import * as path from 'path';
import * as fs from 'fs';
import { Readable, Writable } from 'stream';

export interface ProcessRunnerEvents {
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

    protected abstract async getArgs(): Promise<string[]>;

    protected getPathFromEnv(envName: string): string {
        const somePath = process.env[EnvName.WS_QVH_PATH] || '';
        if (somePath) {
            const isAbsolute = somePath.startsWith('/');
            const absolutePath = isAbsolute ? somePath : path.resolve(process.cwd(), somePath);
            if (!fs.existsSync(absolutePath)) {
                console.error(`Can't find path "${absolutePath}" from env ${envName}`);
            } else {
                return absolutePath;
            }
        }
        return '';
    }

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
            this.emit('started', true);
        });

        this.proc.on('exit', (code, signal) => {
            console.log(this.name, `"exit" event. code ${code}, signal: ${signal}`);
            this.emit('exit', { code, signal });
        });

        this.proc.on('error', (error) => {
            console.error(this.name, `failed to spawn process.\n${error.stack}`);
            this.emit('error', error);
        });

        this.proc.on('close', (code, signal) => {
            console.log(this.name, `"close" event. code ${code}, signal: ${signal}`);
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

    public start(): void {
        this.runProcess().catch((e) => {
            console.error(this.name, e.message);
        });
    }

    public isStarted(): boolean {
        return this.spawned;
    }
}
