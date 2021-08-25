import FilePushHandler, { DragAndPushListener, PushUpdateParams } from './filePush/FilePushHandler';

const TAG = '[DragAndPushLogger]';

export default class DragAndPushLogger implements DragAndPushListener {
    private static readonly X: number = 20;
    private static readonly Y: number = 40;
    private static readonly HEIGHT = 12;
    private static readonly LOG_BACKGROUND: string = 'rgba(0,0,0, 0.5)';
    private static readonly DEBUG_COLOR: string = 'hsl(136, 85%,50%)';
    private static readonly ERROR_COLOR: string = 'hsl(336,85%,50%)';

    private readonly ctx: CanvasRenderingContext2D | null = null;
    private timeoutMap: Map<number, number> = new Map();
    private dirtyMap: Map<number, number> = new Map();
    private pushLineMap: Map<string, number> = new Map();
    private linePushMap: Map<number, string> = new Map();
    private dirtyLines: boolean[] = [];
    constructor(element: HTMLElement) {
        if (element instanceof HTMLCanvasElement) {
            const canvas = element as HTMLCanvasElement;
            this.ctx = canvas.getContext('2d');
        }
    }
    cleanDirtyLine = (line: number): void => {
        if (!this.ctx) {
            return;
        }
        const { X, Y, HEIGHT } = DragAndPushLogger;
        const x = X;
        const y = Y + HEIGHT * line * 2;
        const dirty = this.dirtyMap.get(line);
        if (dirty) {
            const p = DragAndPushLogger.HEIGHT / 2;
            const d = p * 2;
            this.ctx.clearRect(x - p, y - HEIGHT - p, dirty + d, HEIGHT + d);
        }
        this.dirtyLines[line] = false;
    };
    private logText(text: string, line: number, scheduleCleanup = false, error = false): void {
        if (!this.ctx) {
            error ? console.error(TAG, text) : console.log(TAG, text);
            return;
        }
        if (error) {
            console.error(TAG, text);
        }
        this.cleanDirtyLine(line);

        const { X, Y, HEIGHT } = DragAndPushLogger;
        const x = X;
        const y = Y + HEIGHT * line * 2;
        this.ctx.save();
        this.ctx.font = `${HEIGHT}px monospace`;
        const textMetrics = this.ctx.measureText(text);
        const width = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
        this.dirtyMap.set(line, width);
        this.ctx.fillStyle = DragAndPushLogger.LOG_BACKGROUND;
        const p = DragAndPushLogger.HEIGHT / 2 - 1;
        const d = p * 2;
        this.ctx.fillRect(x - p, y - HEIGHT - p, width + d, HEIGHT + d);
        this.ctx.fillStyle = error ? DragAndPushLogger.ERROR_COLOR : DragAndPushLogger.DEBUG_COLOR;
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
        if (scheduleCleanup) {
            this.dirtyLines[line] = true;
            let timeout = this.timeoutMap.get(line);
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = window.setTimeout(() => {
                this.cleanDirtyLine(line);
                const key = this.linePushMap.get(line);
                if (typeof key === 'string') {
                    this.linePushMap.delete(line);
                    this.pushLineMap.delete(key);
                }
            }, 5000);
            this.timeoutMap.set(line, timeout);
        }
    }

    public onDragEnter(): boolean {
        this.logText('Drop APK files here', 1);
        return true;
    }

    public onDragLeave(): boolean {
        this.cleanDirtyLine(1);
        return true;
    }

    public onDrop(): boolean {
        this.cleanDirtyLine(1);
        return true;
    }

    public onError(error: Error | string): void {
        const text = typeof error === 'string' ? error : error.message;
        this.logText(text, 1, true);
    }

    onFilePushUpdate(data: PushUpdateParams): void {
        const { pushId, message, fileName, error } = data;
        const key = `${pushId}/${fileName}`;
        const firstKey = `${FilePushHandler.REQUEST_NEW_PUSH_ID}/${fileName}`;
        let line: number | undefined = this.pushLineMap.get(key);
        let update = false;
        if (typeof line === 'undefined' && key !== firstKey) {
            line = this.pushLineMap.get(firstKey);
            if (typeof line !== 'undefined') {
                this.pushLineMap.delete(firstKey);
                update = true;
            }
        }
        if (typeof line === 'undefined') {
            line = 2;
            while (this.dirtyLines[line]) {
                line++;
            }
            update = true;
        }
        if (update) {
            this.pushLineMap.set(key, line);
            this.linePushMap.set(line, key);
        }
        this.logText(`Upload "${fileName}": ${message}`, line, true, error);
    }
}
