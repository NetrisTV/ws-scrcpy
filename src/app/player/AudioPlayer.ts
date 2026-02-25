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
    private audioCtx: AudioContext;
    private decoder: AudioDecoder | null = null;
    private nextPlayTime = 0;
    private stopped = false;
    private sampleCount = 0;  // monotonic sample counter for timestamps
    private playing = false;  // true once AudioContext is actually running
    private pendingDescription?: Uint8Array;

    public static isSupported(): boolean {
        return typeof AudioDecoder !== 'undefined' && typeof AudioContext !== 'undefined';
    }

    constructor() {
        // Create AudioContext immediately during a user gesture (the stream
        // start click). This avoids the 10-15s delay that occurred when
        // creation was deferred to the first audio config packet.
        this.audioCtx = new AudioContext({ latencyHint: 'interactive' });

        if (this.audioCtx.state === 'running') {
            this.playing = true;
        } else {
            // Listen for state change so we can start playing as soon as
            // the browser allows audio (user gesture propagation).
            this.audioCtx.addEventListener('statechange', () => {
                if (this.audioCtx.state === 'running' && !this.playing && !this.stopped) {
                    this.playing = true;
                    // If we already received a config packet while suspended,
                    // set up the decoder now.
                    if (this.pendingDescription !== undefined) {
                        this.setupDecoder(this.audioCtx, this.pendingDescription);
                    }
                }
            });
            // Attempt resume immediately — if we're inside a user gesture
            // call stack, this will succeed synchronously or very quickly.
            this.audioCtx.resume().catch(() => undefined);
        }
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
        // suspended (browser autoplay policy).
        if (!this.playing) return;

        if (!this.decoder) return;
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

        // Store the config description for use when context becomes ready
        this.pendingDescription = description;

        // If context is already running, set up the decoder immediately
        if (this.audioCtx.state === 'running') {
            this.setupDecoder(this.audioCtx, description);
            this.playing = true;
        }
        // Otherwise, the statechange listener will call setupDecoder
    }

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
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
        // The statechange listener handles transitioning to playing state
    }

    public stop(): void {
        this.stopped = true;
        this.playing = false;
        if (this.decoder && this.decoder.state !== 'closed') {
            this.decoder.close();
        }
        this.decoder = null;
        this.audioCtx.close().catch(() => undefined);
    }
}
