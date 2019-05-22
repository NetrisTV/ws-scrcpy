export default class H264bsdWorker {
    private static instance: H264bsdWorker;
    public static getInstance(): H264bsdWorker {
        if (!this.instance) {
            this.instance = new H264bsdWorker();
        }
        return this.instance;
    }

    private decoderReady: boolean = false;
    public readonly worker: Worker;
    private constructor() {
        this.worker = new Worker('h264bsd_worker.js');
        this.worker.addEventListener('message', (e: MessageEvent) => {
            const message = e.data;
            if (!message.hasOwnProperty('type')) {
                return;
            }
            // Posted after the worker creates and configures a decoder
            if (message.type === 'decoderReady') {
                this.decoderReady = true;
            }
        });
    }
    public isDecoderReady(): boolean {
        return this.decoderReady;
    }
}
