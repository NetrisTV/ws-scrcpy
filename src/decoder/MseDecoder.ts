import Decoder from './Decoder';
import VideoConverter, { setLogger } from 'h264-converter';
import VideoSettings from '../VideoSettings';
import Size from '../Size';

interface QualityStats {
    timestamp: number;
    decodedFrames: number;
    droppedFrames: number;
}

// sourceBuffer is private in h264-converter
type ConverterFake = {
    sourceBuffer: SourceBuffer
}

export default class MseDecoder extends Decoder {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 8000000,
        maxFps: 60,
        iFrameInterval: 10,
        bounds: new Size(720, 720),
        sendFrameMeta: false,
    });
    private static DEFAULT_FRAMES_PER_FRAGMENT = 1;
    private static DEFAULT_FRAMES_PER_SECOND = 60;

    public static createElement(id?: string): HTMLVideoElement {
        const tag = document.createElement('video') as HTMLVideoElement;
        tag.muted = true;
        tag.autoplay = true;
        tag.setAttribute('muted', 'muted');
        tag.setAttribute('autoplay', 'autoplay');
        if (typeof id === 'string') {
            tag.id = id;
        }
        tag.className = 'video-layer';
        return tag;
    }

    private converter?: VideoConverter;
    private videoStats: QualityStats[] = [];
    private stalledCounter = 0;
    private isSeeking = false;
    public fpf: number = MseDecoder.DEFAULT_FRAMES_PER_FRAGMENT;
    public readonly supportsScreenshot: boolean = true;
    private sourceBuffer?: SourceBuffer;
    private removeStart = -1;
    private removeEnd = -1;

    constructor(udid: string, protected tag: HTMLVideoElement = MseDecoder.createElement()) {
        super(udid, 'MseDecoder', tag);
        tag.onerror = function (e: Event | string): void {
            console.error(e);
        };
        tag.oncontextmenu = function (e: MouseEvent): boolean {
            e.preventDefault();
            return false;
        };
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setLogger(() => {}, console.error);
    }

    private static createConverter(
        tag: HTMLVideoElement,
        fps: number = MseDecoder.DEFAULT_FRAMES_PER_SECOND,
        fpf: number = MseDecoder.DEFAULT_FRAMES_PER_FRAGMENT,
    ): VideoConverter {
        return new VideoConverter(tag, fps, fpf);
    }

    private getVideoPlaybackQuality(): QualityStats | null {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const video = this.tag as any;
        if (typeof video.mozDecodedFrames !== 'undefined') {
            return null;
        }
        const now = Date.now();
        if (typeof this.tag.getVideoPlaybackQuality == 'function') {
            const temp = this.tag.getVideoPlaybackQuality();
            return {
                timestamp: now,
                decodedFrames: temp.totalVideoFrames,
                droppedFrames: temp.droppedVideoFrames,
            };
        }

        // Webkit-specific properties
        if (typeof video.webkitDecodedFrameCount !== 'undefined') {
            return {
                timestamp: now,
                decodedFrames: video.webkitDecodedFrameCount,
                droppedFrames: video.webkitDroppedFrameCount,
            };
        }
        return null;
    }

    protected calculateMomentumStats(): void {
        const stat = this.getVideoPlaybackQuality();
        if (!stat) {
            return;
        }

        const timestamp = Date.now();
        const oneSecondBefore = timestamp - 1000;
        this.videoStats.push(stat);

        while (this.videoStats.length && this.videoStats[0].timestamp < oneSecondBefore) {
            this.videoStats.shift();
        }
        while (this.inputBytes.length && this.inputBytes[0].timestamp < oneSecondBefore) {
            this.inputBytes.shift();
        }
        let inputBytes = 0;
        this.inputBytes.forEach((item) => {
            inputBytes += item.bytes;
        });
        const inputFrames = this.inputBytes.length;
        if (this.videoStats.length) {
            const oldest = this.videoStats[0];
            const decodedFrames = stat.decodedFrames - oldest.decodedFrames;
            const droppedFrames = stat.droppedFrames - oldest.droppedFrames;
            // const droppedFrames = inputFrames - decodedFrames;
            this.momentumQualityStats = {
                decodedFrames,
                droppedFrames,
                inputBytes,
                inputFrames,
                timestamp,
            };
        }
    }

    protected resetStats(): void {
        super.resetStats();
        this.videoStats = [];
    }

    public getImageDataURL(): string {
        const canvas = document.createElement('canvas');
        canvas.width = this.tag.clientWidth;
        canvas.height = this.tag.clientHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(this.tag, 0, 0, canvas.width, canvas.height);
        }

        return canvas.toDataURL();
    }

    public play(): void {
        super.play();
        if (this.getState() !== Decoder.STATE.PLAYING || !this.screenInfo) {
            return;
        }
        if (!this.converter) {
            let fps = MseDecoder.DEFAULT_FRAMES_PER_SECOND;
            if (this.videoSettings) {
                fps = this.videoSettings.maxFps;
            }
            this.converter = MseDecoder.createConverter(this.tag, fps, this.fpf);
            this.resetStats();
        }
        this.converter.play();
    }

    public pause(): void {
        super.pause();
        this.stopConverter();
    }

    public stop(): void {
        super.stop();
        this.stopConverter();
    }

    public setVideoSettings(videoSettings: VideoSettings, saveToStorage: boolean): void {
        if (this.videoSettings && this.videoSettings.maxFps !== videoSettings.maxFps) {
            const state = this.getState();
            if (this.converter) {
                this.stop();
                this.converter = MseDecoder.createConverter(this.tag, videoSettings.maxFps, this.fpf);
            }
            if (state === Decoder.STATE.PLAYING) {
                this.play();
            }
        }
        super.setVideoSettings(videoSettings, saveToStorage);
    }

    public getPreferredVideoSetting(): VideoSettings {
        return MseDecoder.preferredVideoSettings;
    }

    cleanSourceBuffer = (): void => {
        if (!this.sourceBuffer) {
            return;
        }
        if (this.sourceBuffer.updating) {
            return;
        }
        try {
            this.sourceBuffer.remove(this.removeStart, this.removeEnd);
            this.sourceBuffer.removeEventListener('updateend', this.cleanSourceBuffer);
            this.removeStart = this.removeEnd = -1;
        } catch (e) {
            console.error(this.name, 'Failed to clean source buffer');
        }
    };

    public pushFrame(frame: Uint8Array): void {
        super.pushFrame(frame);
        if (this.converter) {
            if (Decoder.isIFrame(frame)) {
                let start = 0;
                let end = 0;
                if (this.tag.buffered && this.tag.buffered.length) {
                    start = this.tag.buffered.start(0);
                    end = this.tag.buffered.end(0) | 0;
                }
                if (end !== 0 && start < end) {
                    const sourceBuffer: SourceBuffer = (this.converter as unknown as ConverterFake).sourceBuffer;
                    if (!sourceBuffer.updating) {
                        sourceBuffer.remove(start, end);
                    } else {
                        this.sourceBuffer = sourceBuffer;
                        if (this.removeEnd !== -1 || this.removeEnd !== -1) {
                            this.removeEnd = end;
                        } else {
                            this.removeStart = start;
                            this.removeEnd = end;
                        }
                        sourceBuffer.addEventListener('updateend', this.cleanSourceBuffer);
                    }
                }
            }
            this.converter.appendRawData(frame);
        }

        // Workaround for stalled playback (`stalled` event is not fired, but the image freezes)
        if (this.momentumQualityStats && !this.isSeeking) {
            if (this.momentumQualityStats.decodedFrames === 0 && this.momentumQualityStats.inputFrames > 0) {
                this.stalledCounter++;
            } else {
                this.stalledCounter = 0;
            }
        }
        if (this.tag.buffered.length) {
            const end = this.tag.buffered.end(0);
            const buffered = end - this.tag.currentTime;
            const MAX_BUFFER = 0.2;
            const MAX_AHEAD = 0.2;
            let hasReasonToJump = false;
            if (this.stalledCounter > 5) {
                // `Stalled (for ${this.stalledCounter} frames).`;
                hasReasonToJump = true
            }
            if (buffered > MAX_BUFFER) {
                // `Buffer is bigger then ${MAX_BUFFER} seconds (=${buffered.toFixed(3)}).`;
                hasReasonToJump = true;
            }
            if (buffered < -MAX_AHEAD) {
                // `Current time is more then ${MAX_AHEAD} seconds ahead of end (HOW?!) (=${-buffered.toFixed(3)}).`;
                hasReasonToJump = true;
            }
            if (!hasReasonToJump) {
                return;
            }
            if (this.tag.seeking && this.stalledCounter < 10) {
                // console.info(`${this.name}. ${reasonToJump} But already seeking. Do nothing.`);
                return;
            }
            // console.info(`${this.name}. ${reasonToJump} Jumping to the end. ${this.stalledCounter}`);

            this.tag.currentTime = this.tag.buffered.end(0);
            this.stalledCounter = 0;
        }
    }

    private stopConverter(): void {
        if (this.converter) {
            this.converter.appendRawData(new Uint8Array([]));
            this.converter.pause();
            delete this.converter;
        }
    }
}
