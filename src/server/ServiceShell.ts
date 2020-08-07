import { ReleasableService } from './ReleasableService';
import WebSocket from 'ws';
import * as pty from 'node-pty';
import * as os from 'os';
import { IPty } from 'node-pty';
import { Message } from '../common/Message';
import { XtermClientMessage, XtermServiceParameters } from '../common/XtermMessage';

const OS_WINDOWS = os.platform() === 'win32';
const USE_BINARY = !OS_WINDOWS;
const EVENT_TYPE_SHELL = 'shell';

export class ServiceShell extends ReleasableService {
    private term?: IPty;
    private initialized = false;
    constructor(ws: WebSocket) {
        super(ws);
    }

    public static createTerminal(ws: WebSocket, params: XtermServiceParameters): IPty {
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
        const send = USE_BINARY ? this.bufferUtf8(ws, 5) : this.buffer(ws, 5);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Documentation is incorrect for `encoding: null`
        term.on('data', send);
        term.on('exit', () => {
            ws.close();
        });
        return term;
    }

    protected onSocketMessage(event: WebSocket.MessageEvent): void {
        if (this.initialized) {
            if (!this.term) {
                return;
            }
            return this.term.write(event.data as string);
        }
        let data;
        try {
            data = JSON.parse(event.data.toString());
        } catch (e) {
            console.error(e.message);
            return;
        }
        this.handleMessage(data as Message).catch((e: Error) => {
            console.error(e.message);
        });
    }

    private handleMessage = async (message: Message): Promise<void> => {
        if (message.type !== EVENT_TYPE_SHELL) {
            return;
        }
        const data: XtermClientMessage = message.data as XtermClientMessage;
        const { type } = data;
        if (type === 'start') {
            this.term = ServiceShell.createTerminal(this.ws, data);
            this.initialized = true;
        }
        if (type === 'stop') {
            this.release();
        }
    };

    // string message buffering
    private static buffer(ws: WebSocket, timeout: number): (data: string) => void {
        let s = '';
        let sender: NodeJS.Timeout | null = null;
        return (data: string) => {
            s += data;
            if (!sender) {
                sender = setTimeout(() => {
                    ws.send(s);
                    s = '';
                    sender = null;
                }, timeout);
            }
        };
    }

    private static bufferUtf8(ws: WebSocket, timeout: number): (data: Buffer) => void {
        let buffer: Buffer[] = [];
        let sender: NodeJS.Timeout | null = null;
        let length = 0;
        return (data: Buffer) => {
            buffer.push(data);
            length += data.length;
            if (!sender) {
                sender = setTimeout(() => {
                    ws.send(Buffer.concat(buffer, length));
                    buffer = [];
                    sender = null;
                    length = 0;
                }, timeout);
            }
        };
    }

    public static createService(ws: WebSocket): ReleasableService {
        return new ServiceShell(ws);
    }

    public release(): void {
        super.release();
        if (this.term) {
            this.term.kill();
        }
    }
}
