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

// How many seconds of decoded audio to buffer before we start playing.
// Lower = less latency, higher = fewer glitches on slow connections.
const BUFFER_TARGET_S = 0.1;

// Maximum allowed drift before we drop buffered audio to re-sync.
const MAX_LATENCY_S = 0.8;

export class AudioPlayer {
    private audioCtx: AudioContext | null = null;
    private decoder: AudioDecoder | null = null;
    private nextPlayTime = 0;
    private stopped = false;

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

        if (!this.decoder || !this.audioCtx) return;
        if (this.decoder.state === 'closed') return;

        try {
            const chunk = new EncodedAudioChunk({
                type: 'key',
                timestamp: 0,
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

        // Lazily create AudioContext on first init (respects autoplay policy)
        if (!this.audioCtx) {
            this.audioCtx = new AudioContext();
            this.nextPlayTime = this.audioCtx.currentTime + BUFFER_TARGET_S;
        }

        const ctx = this.audioCtx;

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

        // Drop audio if we've drifted too far behind
        if (this.nextPlayTime < now - MAX_LATENCY_S) {
            console.warn(TAG, 'audio drift too large, resetting buffer');
            this.nextPlayTime = now + BUFFER_TARGET_S;
        }

        // Schedule slightly in the future if we're behind current time
        if (this.nextPlayTime < now) {
            this.nextPlayTime = now + BUFFER_TARGET_S;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(this.nextPlayTime);

        this.nextPlayTime += buffer.duration;
    }

    /** Resume AudioContext if it was suspended (browser autoplay policy). */
    public async resume(): Promise<void> {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
    }

    public stop(): void {
        this.stopped = true;
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
