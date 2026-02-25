/**
 * AudioPlayer — decodes Opus audio packets from the scrcpy v2 stream and
 * plays them through the Web Audio API.
 *
 * Protocol (each Uint8Array emitted by StreamReceiver 'audio' event):
 *   byte[0]  : 0x01 = codec config packet, 0x00 = data packet
 *   byte[1…] : raw Opus frame data
 *
 * Decoding strategy:
 *   Primary  — WebCodecs AudioDecoder  (Chrome/Edge 94+, Safari 16.4+)
 *   Fallback — Not implemented yet; a WASM Opus decoder can be added here
 */

const TAG = '[AudioPlayer]';

// Maximum allowed drift before we drop buffered audio to re-sync.
const MAX_LATENCY_S = 0.10;

export class AudioPlayer {
    private audioCtx: AudioContext | null = null;
    private decoder: AudioDecoder | null = null;
    private nextPlayTime = 0;
    private stopped = false;
    private sampleCount = 0;  // monotonic sample counter for timestamps
    private playing = false;  // true once AudioContext is actually running

    public static isSupported(): boolean {
        return typeof AudioDecoder !== 'undefined' && typeof AudioContext !== 'undefined';
    }

    constructor() {
        // AudioContext must be created (or resumed) after a user gesture.
        // We defer creation until the first audio packet to avoid autoplay
        // policy issues in browsers.
    }

    /**
     * Feed a raw audio packet from the stream.
     * @param data  Uint8Array where byte[0] is the IS_CONFIG flag
     */
    public pushAudioData(data: Uint8Array): void {
        if (this.stopped) return;

        const isConfig = data[0] === 1;
        const payload = data.slice(1);

        if (isConfig) {
            this.initDecoder(payload);
            return;
        }

        // Drop audio data until the AudioContext is actually running.
        // This avoids accumulating a huge backlog while the context is
        // suspended (browser autoplay policy), which causes the 5-6s
        // delay when audio finally starts.
        if (!this.playing) return;

        if (!this.decoder || !this.audioCtx) return;
        if (this.decoder.state === 'closed') return;

        try {
            // Opus frames are typically 20ms at 48kHz = 960 samples
            const timestamp = this.sampleCount * (1_000_000 / 48000); // microseconds
            this.sampleCount += 960;
            const chunk = new EncodedAudioChunk({
                type: 'key',
                timestamp,
                data: payload,
            });
            this.decoder.decode(chunk);
        } catch (e: any) {
            console.warn(TAG, 'decode error:', e.message);
        }
    }

    private initDecoder(description?: Uint8Array): void {
        if (!AudioPlayer.isSupported()) {
            console.warn(TAG, 'WebCodecs AudioDecoder not supported in this browser');
            return;
        }

        // Close previous decoder if any
        if (this.decoder && this.decoder.state !== 'closed') {
            this.decoder.close();
        }
        this.sampleCount = 0;

        // Lazily create AudioContext on first init (respects autoplay policy)
        if (!this.audioCtx) {
            this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
        }

        // Store the config description for re-init after resume
        this.pendingDescription = description;

        const ctx = this.audioCtx;

        // If context is already running, set up the decoder immediately
        if (ctx.state === 'running') {
            this.setupDecoder(ctx, description);
            this.playing = true;
        }
        // If suspended, we'll set up the decoder in resume() once context is running
    }

    private pendingDescription?: Uint8Array;

    private setupDecoder(ctx: AudioContext, description?: Uint8Array): void {
        // Close previous decoder if any
        if (this.decoder && this.decoder.state !== 'closed') {
            this.decoder.close();
        }
        this.sampleCount = 0;
        this.nextPlayTime = ctx.currentTime;

        this.decoder = new AudioDecoder({
            output: (audioData: AudioData) => {
                this.onDecodedFrame(audioData, ctx);
            },
            error: (e: Error) => {
                console.error(TAG, 'AudioDecoder error:', e.message);
            },
        });

        const config: AudioDecoderConfig = {
            codec: 'opus',
            sampleRate: 48000,
            numberOfChannels: 2,
        };
        if (description && description.byteLength > 0) {
            config.description = description;
        }

        try {
            this.decoder.configure(config);
        } catch (e: any) {
            console.error(TAG, 'configure error:', e.message);
        }
    }

    private onDecodedFrame(audioData: AudioData, ctx: AudioContext): void {
        if (this.stopped) {
            audioData.close();
            return;
        }

        const numFrames = audioData.numberOfFrames;
        const numChannels = audioData.numberOfChannels;
        const sampleRate = audioData.sampleRate;

        // Build an AudioBuffer and schedule playback
        const buffer = ctx.createBuffer(numChannels, numFrames, sampleRate);

        for (let ch = 0; ch < numChannels; ch++) {
            const dest = buffer.getChannelData(ch);
            audioData.copyTo(dest, { planeIndex: ch, format: 'f32-planar' });
        }
        audioData.close();

        const now = ctx.currentTime;

        // Drop audio if we've drifted too far behind — play from now
        if (this.nextPlayTime < now - MAX_LATENCY_S) {
            this.nextPlayTime = now;
        }

        // If behind current time, catch up immediately
        if (this.nextPlayTime < now) {
            this.nextPlayTime = now;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(this.nextPlayTime);

        this.nextPlayTime += buffer.duration;
    }

    /** Resume AudioContext if it was suspended (browser autoplay policy). */
    public async resume(): Promise<void> {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
        // Once AudioContext is running, set up the decoder and start accepting frames
        if (this.audioCtx.state === 'running' && !this.playing) {
            this.playing = true;
            this.setupDecoder(this.audioCtx, this.pendingDescription);
        }
    }

    public stop(): void {
        this.stopped = true;
        this.playing = false;
        if (this.decoder && this.decoder.state !== 'closed') {
            this.decoder.close();
        }
        this.decoder = null;
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => undefined);
            this.audioCtx = null;
        }
    }
}
