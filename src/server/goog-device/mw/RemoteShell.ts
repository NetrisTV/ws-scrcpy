import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import * as pty from 'node-pty';
import * as os from 'os';
import { IPty } from 'node-pty';
import { Message } from '../../../types/Message';
import { XtermClientMessage, XtermServiceParameters } from '../../../types/XtermMessage';
import { ACTION } from '../../../common/Action';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';

const OS_WINDOWS = os.platform() === 'win32';
const USE_BINARY = !OS_WINDOWS;
const EVENT_TYPE_SHELL = 'shell';

export class RemoteShell extends Mw {
    public static readonly TAG = 'RemoteShell';
    private term?: IPty;
    private initialized = false;
    private timeoutString: NodeJS.Timeout | null = null;
    private timeoutBuffer: NodeJS.Timeout | null = null;
    private terminated = false;
    private closeCode = 1000;
    private closeReason = '';

    public static processChannel(ws: Multiplexer, code: string): Mw | undefined {
        if (code !== ChannelCode.SHEL) {
            return;
        }
        return new RemoteShell(ws);
    }

    public static processRequest(ws: WS, params: RequestParameters): RemoteShell | undefined {
        if (params.action !== ACTION.SHELL) {
            return;
        }
        return new RemoteShell(ws);
    }

    constructor(protected ws: WS | Multiplexer) {
        super(ws);
    }

    public createTerminal(params: XtermServiceParameters): IPty {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = Object.assign({}, process.env) as any;
        env['COLORTERM'] = 'truecolor';
        const { cols = 80, rows = 24 } = params;
        const cwd = env.PWD || '/';
        const file = OS_WINDOWS ? 'adb.exe' : 'adb';
        const term = pty.spawn(file, ['-s', params.udid, 'shell'], {
            name: 'xterm-256color',
            cols,
            rows,
            cwd,
            env,
            encoding: null,
        });
        const send = USE_BINARY ? this.bufferUtf8(5) : this.buffer(5);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Documentation is incorrect for `encoding: null`
        term.on('data', send);
        term.on('exit', (code: number) => {
            if (code === 0) {
                this.closeCode = 1000;
            } else {
                this.closeCode = 4500;
            }
            this.closeReason = `[${[RemoteShell.TAG]}] terminal process exited with code: ${code}`;
            if (this.timeoutString || this.timeoutBuffer) {
                this.terminated = true;
            } else {
                this.ws.close(this.closeCode, this.closeReason);
            }
        });
        return term;
    }

    protected onSocketMessage(event: WS.MessageEvent): void {
        if (this.initialized) {
            if (!this.term) {
                return;
            }
            return this.term.write(event.data as string);
        }
        let data;
        try {
            data = JSON.parse(event.data.toString());
        } catch (error: any) {
            console.error(`[${RemoteShell.TAG}]`, error?.message);
            return;
        }
        this.handleMessage(data as Message).catch((error: Error) => {
            console.error(`[${RemoteShell.TAG}]`, error.message);
        });
    }

    private handleMessage = async (message: Message): Promise<void> => {
        if (message.type !== EVENT_TYPE_SHELL) {
            return;
        }
        const data: XtermClientMessage = message.data as XtermClientMessage;
        const { type } = data;
        if (type === 'start') {
            this.term = this.createTerminal(data);
            this.initialized = true;
        }
        if (type === 'stop') {
            this.release();
        }
    };

    // string message buffering
    private buffer(timeout: number): (data: string) => void {
        let s = '';
        return (data: string) => {
            s += data;
            if (!this.timeoutString) {
                this.timeoutString = setTimeout(() => {
                    this.ws.send(s);
                    s = '';
                    this.timeoutString = null;
                    if (this.terminated) {
                        this.ws.close(this.closeCode, this.closeReason);
                    }
                }, timeout);
            }
        };
    }

    private bufferUtf8(timeout: number): (data: Buffer) => void {
        let buffer: Buffer[] = [];
        let length = 0;
        return (data: Buffer) => {
            buffer.push(data);
            length += data.length;
            if (!this.timeoutBuffer) {
                this.timeoutBuffer = setTimeout(() => {
                    this.ws.send(Buffer.concat(buffer, length));
                    buffer = [];
                    this.timeoutBuffer = null;
                    length = 0;
                    if (this.terminated) {
                        this.ws.close(this.closeCode, this.closeReason);
                    }
                }, timeout);
            }
        };
    }

    public release(): void {
        super.release();
        if (this.timeoutBuffer) {
            clearTimeout(this.timeoutBuffer);
        }
        if (this.timeoutString) {
            clearTimeout(this.timeoutString);
        }
        if (this.term) {
            this.term.kill();
        }
    }
}
