import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Rect from '../Rect';
import Size from '../Size';
import Util from '../Util';
import { TypedEmitter } from '../../common/TypedEmitter';
import { DisplayInfo } from '../DisplayInfo';

interface BitrateStat {
    timestamp: number;
    bytes: number;
}

interface FramesPerSecondStats {
    avgInput: number;
    avgDecoded: number;
    avgDropped: number;
    avgSize: number;
}

export interface PlaybackQuality {
    decodedFrames: number;
    droppedFrames: number;
    inputFrames: number;
    inputBytes: number;
    timestamp: number;
}

export interface PlayerEvents {
    'video-view-resize': Size;
    'input-video-resize': ScreenInfo;
    'video-settings': VideoSettings;
}

export interface PlayerClass {
    playerFullName: string;
    playerCodeName: string;
    storageKeyPrefix: string;
    isSupported(): boolean;
    getPreferredVideoSetting(): VideoSettings;
    getFitToScreenStatus(deviceName: string, displayInfo?: DisplayInfo): boolean;
    loadVideoSettings(deviceName: string, displayInfo?: DisplayInfo): VideoSettings;
    saveVideoSettings(
        deviceName: string,
        videoSettings: VideoSettings,
        fitToScreen: boolean,
        displayInfo?: DisplayInfo,
    ): void;
    new(udid: string, displayInfo?: DisplayInfo): BasePlayer;
}

export abstract class BasePlayer extends TypedEmitter<PlayerEvents> {
    private static readonly STAT_BACKGROUND: string = 'rgba(0, 0, 0, 0.5)';
    private static readonly STAT_TEXT_COLOR: string = 'hsl(24, 85%, 50%)';
    public static readonly DEFAULT_SHOW_QUALITY_STATS = false;
    public static STATE: Record<string, number> = {
        PLAYING: 1,
        PAUSED: 2,
        STOPPED: 3,
    };
    private static STATS_HEIGHT = 12;
    protected screenInfo?: ScreenInfo;
    protected videoSettings: VideoSettings;
    protected parentElement?: HTMLElement;
    protected touchableCanvas: HTMLCanvasElement;
    protected inputBytes: BitrateStat[] = [];
    protected perSecondQualityStats?: FramesPerSecondStats;
    protected momentumQualityStats?: PlaybackQuality;
    protected bounds: Size | null = null;
    private totalStats: PlaybackQuality = {
        decodedFrames: 0,
        droppedFrames: 0,
        inputFrames: 0,
        inputBytes: 0,
        timestamp: 0,
    };
    private totalStatsCounter = 0;
    private dirtyStatsWidth = 0;
    private state: number = BasePlayer.STATE.STOPPED;
    private qualityAnimationId?: number;
    private showQualityStats = BasePlayer.DEFAULT_SHOW_QUALITY_STATS;
    protected receivedFirstFrame = false;
    private statLines: string[] = [];
    public readonly supportsScreenshot: boolean = false;
    public readonly resizeVideoToBounds: boolean = false;
    protected videoHeight = -1;
    protected videoWidth = -1;

    public static storageKeyPrefix = 'BaseDecoder';
    public static playerFullName = 'BasePlayer';
    public static playerCodeName = 'baseplayer';
    public static preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 524288,
        maxFps: 24,
        iFrameInterval: 5,
        bounds: new Size(480, 480),
        sendFrameMeta: false,
    });

    public static isSupported(): boolean {
        // Implement the check in a child class
        return false;
    }

    constructor(
        public readonly udid: string,
        protected displayInfo?: DisplayInfo,
        protected name: string = 'BasePlayer',
        protected storageKeyPrefix: string = 'Dummy',
        protected tag: HTMLElement = document.createElement('div'),
    ) {
        super();
        this.touchableCanvas = document.createElement('canvas');
        this.touchableCanvas.className = 'touch-layer';
        this.touchableCanvas.style.width = "calc(100vw - 3rem)";
        if (window.innerWidth > 380)
            this.touchableCanvas.style.maxWidth = "315px";
        else
            this.touchableCanvas.style.maxWidth = "80vw";


        const myInterval = setInterval(() => {
            if (tag.clientHeight || tag.clientWidth) {
                this.reOrientScreen();

                window.addEventListener('resize', () => {
                    this.reOrientScreen();
                });

                clearInterval(myInterval);
            }
        }, 500);
        this.touchableCanvas.oncontextmenu = function (event: MouseEvent): void {
            event.preventDefault();
        };
        const preferred = this.getPreferredVideoSetting();
        this.videoSettings = BasePlayer.getVideoSettingFromStorage(preferred, this.storageKeyPrefix, udid, displayInfo);
    }

    protected sendDataToParent(rotation: number | undefined): void {
        // Send data to the parent window

        const videoElem = document.getElementsByClassName("video-layer")[0] as HTMLElement;
        const touchElem = document.getElementsByClassName("touch-layer")[0] as HTMLElement;

        const remToPx = (rem: number) => rem * parseFloat(getComputedStyle(document.documentElement).fontSize);

        const androidFrame = document.getElementById("generic-android-mockup");

        if (androidFrame) {
            // androidFrame.style.width = "calc(100vw - 3rem)";


            const offset = remToPx(3); // Convert 3rem to pixels
            let initialWidth;

            if( rotation ){
                if( window.innerWidth <= 380 )
                    initialWidth = window.innerWidth - offset;
                else
                    initialWidth = window.innerWidth - offset > 550 ? 550 : window.innerWidth - offset
            }
            else {
                
                if( window.innerWidth <= 380 )
                    initialWidth = window.innerWidth - offset;
                else
                    initialWidth = window.innerWidth - offset > 315 ? 315 : window.innerWidth - offset
            }
            // const initialWidth = window.innerWidth <= 380 ? window.innerWidth - offset : ;
            // androidFrame.style.transformOrigin = Math.abs((initialWidth) / 2) + "px " + Math.abs((initialWidth) / 2) + "px";

            if (window.innerWidth > 380){

                if( rotation ){

                    androidFrame.style.transform = "rotateZ(-90deg)";
                    androidFrame.style.transformOrigin = Math.abs((initialWidth * ( 191/320 )) / 2) + "px " + Math.abs((initialWidth * ( 191/320 )) / 2) + "px";
                    androidFrame.style.width = "auto";
                    androidFrame.style.height = initialWidth - remToPx(2.5) + "px";
                    androidFrame.style.aspectRatio = "191/320";
                    androidFrame.style.scale = "1.07";
                    androidFrame.style.marginTop = "-11px";
                    androidFrame.style.marginLeft = "11px";
                }
                else {

                    androidFrame.style.transform = "";
                    androidFrame.style.transformOrigin = Math.abs((initialWidth) / 2) + "px " + Math.abs((initialWidth) / 2) + "px";
                    androidFrame.style.width = initialWidth + "px";
                    androidFrame.style.height = "auto";
                    androidFrame.style.aspectRatio = "47/80";
                    androidFrame.style.scale = "1.07";
                    androidFrame.style.marginTop = "10px";
                    androidFrame.style.marginLeft = "9px";
                }

            }
            else{

                if (rotation) {
                    androidFrame.style.maxWidth = "90vw";
                
                    console.log("initialWidth ", initialWidth);
                    androidFrame.style.transform = "rotateZ(-90deg)";
                    androidFrame.style.transformOrigin = Math.abs(((initialWidth)*( 37 / 64 )) / 2) + "px " + Math.abs(((initialWidth)*( 37 / 64 )) / 2) + "px";
                    androidFrame.style.width = "auto";
                    androidFrame.style.height = "calc(100vw - 3rem)";
                    androidFrame.style.aspectRatio = "38/64";
                    androidFrame.style.scale = "1";
                    androidFrame.style.marginTop = "5px";
                    androidFrame.style.marginLeft = "0px";
    
                }
                else {
                    androidFrame.style.transform = "";
                    androidFrame.style.transformOrigin = Math.abs((initialWidth) / 2) + "px " + Math.abs((initialWidth) / 2) + "px";
                    androidFrame.style.width = initialWidth + "px";
                    androidFrame.style.aspectRatio = "95/161" //"151/256";
                    androidFrame.style.scale = "1.01";
                    androidFrame.style.marginTop = "3px";
                    androidFrame.style.marginLeft = "0px"; 
                }
            }
        }

        if (videoElem) {
            if (rotation) {
    
                if (window.innerWidth > 380){
                    videoElem.style.width = "calc(100vw - 4.5rem)";
                    videoElem.style.maxWidth = "529px";
                    videoElem.style.borderRadius = "1.5rem";
                    videoElem.style.marginTop = "19px";
                    videoElem.style.marginLeft = "11px";
                }
                else{
                    
                    videoElem.style.width = "calc(100vw - 4rem)";
                    videoElem.style.maxWidth = "84vw";
                    videoElem.style.borderRadius = "1rem";
                    videoElem.style.marginTop = "11px";
                    videoElem.style.marginLeft = "7px";
                }  
            }
            else {

                videoElem.style.width = "calc(100vw - 3rem)";

                if (window.innerWidth > 380){

                    videoElem.style.maxWidth = "305px";
                    videoElem.style.marginTop = "10px";
                    videoElem.style.marginLeft = "13px";
                }
                else{

                    videoElem.style.maxWidth = "79.5vw";
                    videoElem.style.marginTop = "9px";
                    videoElem.style.marginLeft = "11px";
                }
            }
        }
        if (touchElem) {
            if (rotation) {
                
                if (window.innerWidth > 380){
                    touchElem.style.width = "calc(100vw - 4.5rem)";
                    touchElem.style.maxWidth = "529px";
                    touchElem.style.borderRadius = "1.5rem";
                    touchElem.style.marginTop = "19px";
                    touchElem.style.marginLeft = "11px";
                }
                else{
                    
                    touchElem.style.width = "calc(100vw - 4rem)";
                    touchElem.style.maxWidth = "84vw";
                    touchElem.style.borderRadius = "1rem";
                    touchElem.style.marginTop = "11px";
                    touchElem.style.marginLeft = "7px";
                }  
            }
            else {

                touchElem.style.width = "calc(100vw - 3rem)";

                if (window.innerWidth > 380){
                    touchElem.style.maxWidth = "305px";
                    touchElem.style.marginTop = "10px";
                    touchElem.style.marginLeft = "13px";
                }
                else{

                    touchElem.style.maxWidth = "79.5vw";
                    touchElem.style.marginTop = "9px";
                    touchElem.style.marginLeft = "11px";
                }
            }
        }

        window.top?.postMessage({ event: "device-rotation", rotation: rotation }, "*"); // Replace '*' with the specific origin for security
    }

    public reOrientScreen(invert: boolean = false, player: BasePlayer = this): void {

        // if( !player ){
        //     console.log("player not found");
        //     player = this;
        // }

        // else {
        //     console.log("player found");
        // }

        // const deviceMockup = document.getElementsByClassName("generic-android-mockup")[0] as HTMLElement;
        // console.log("invert ", invert, player.displayInfo?.rotation, player.videoWidth, player.videoHeight);
        let rotation = invert ? !player?.displayInfo?.rotation : player?.displayInfo?.rotation as number | boolean;

        this.sendDataToParent(player?.displayInfo?.rotation);

        if (rotation) {

            // deviceMockup.style.height = player.videoWidth + "px";
            // deviceMockup.style.width = (player.videoHeight + 23) + "px";
            // player.touchableCanvas.style.width = player.videoWidth + "px";
            // player.touchableCanvas.style.height = (player.videoHeight) + "px";
            // deviceMockup.style.transform = "translate(54%, -26.5%) rotateZ(90deg)";
        }
        else {
            // deviceMockup.style.width = player.videoWidth + "px";
            // deviceMockup.style.height = (player.videoHeight + 23) + "px";
            // player.touchableCanvas.style.width = player.videoWidth + "px";
            // player.touchableCanvas.style.height = (player.videoHeight) + "px";
            // deviceMockup.style.transform = "none";
        }

        player.touchableCanvas.style.zIndex = "20";
    }


    protected calculateScreenInfoForBounds(videoWidth: number, videoHeight: number): void {
        this.videoWidth = videoWidth;
        this.videoHeight = videoHeight;
        if (this.resizeVideoToBounds) {
            let w = videoWidth;
            let h = videoHeight;
            if (this.bounds) {
                let { w: boundsWidth, h: boundsHeight } = this.bounds;
                if (w > boundsWidth || h > boundsHeight) {
                    let scaledHeight;
                    let scaledWidth;
                    if (boundsWidth > w) {
                        scaledHeight = h;
                    } else {
                        scaledHeight = (boundsWidth * h) / w;
                    }
                    if (boundsHeight > scaledHeight) {
                        boundsHeight = scaledHeight;
                    }
                    if (boundsHeight == h) {
                        scaledWidth = w;
                    } else {
                        scaledWidth = (boundsHeight * w) / h;
                    }
                    if (boundsWidth > scaledWidth) {
                        boundsWidth = scaledWidth;
                    }
                    w = boundsWidth | 0;
                    h = boundsHeight | 0;
                    this.tag.style.maxWidth = `${w}px`;
                    this.tag.style.maxHeight = `${h}px`;
                }
            }
            const realScreen = new ScreenInfo(new Rect(0, 0, videoWidth, videoHeight), new Size(w, h), 0);
            this.emit('input-video-resize', realScreen);
            this.setScreenInfo(new ScreenInfo(new Rect(0, 0, w, h), new Size(w, h), 0));
        }
    }

    protected static isIFrame(frame: Uint8Array): boolean {
        // last 5 bits === 5: Coded slice of an IDR picture

        // https://www.ietf.org/rfc/rfc3984.txt
        // 1.3.  Network Abstraction Layer Unit Types
        // https://www.itu.int/rec/T-REC-H.264-201906-I/en
        // Table 7-1 – NAL unit type codes, syntax element categories, and NAL unit type classes
        return frame && frame.length > 4 && (frame[4] & 31) === 5;
    }

    private static getStorageKey(storageKeyPrefix: string, udid: string): string {
        const { innerHeight, innerWidth } = window;
        return `${storageKeyPrefix}:${udid}:${innerWidth}x${innerHeight}`;
    }

    private static getFullStorageKey(storageKeyPrefix: string, udid: string, displayInfo?: DisplayInfo): string {
        const { innerHeight, innerWidth } = window;
        let base = `${storageKeyPrefix}:${udid}:${innerWidth}x${innerHeight}`;
        if (displayInfo) {
            const { displayId, size } = displayInfo;
            base = `${base}:${displayId}:${size.width}x${size.height}`;
        }
        return base;
    }

    public static getFromStorageCompat(prefix: string, udid: string, displayInfo?: DisplayInfo): string | null {
        const shortKey = this.getStorageKey(prefix, udid);
        const savedInShort = window.localStorage.getItem(shortKey);
        if (!displayInfo) {
            return savedInShort;
        }
        const isDefaultDisplay = displayInfo.displayId === DisplayInfo.DEFAULT_DISPLAY;
        const fullKey = this.getFullStorageKey(prefix, udid, displayInfo);
        const savedInFull = window.localStorage.getItem(fullKey);
        if (savedInFull) {
            if (savedInShort && isDefaultDisplay) {
                window.localStorage.removeItem(shortKey);
            }
            return savedInFull;
        }
        if (isDefaultDisplay) {
            return savedInShort;
        }
        return null;
    }

    public static getFitToScreenFromStorage(
        storageKeyPrefix: string,
        udid: string,
        displayInfo?: DisplayInfo,
    ): boolean {
        if (!window.localStorage) {
            return false;
        }
        let parsedValue = false;
        const key = `${this.getFullStorageKey(storageKeyPrefix, udid, displayInfo)}:fit`;
        const saved = window.localStorage.getItem(key);
        if (!saved) {
            return false;
        }
        try {
            parsedValue = JSON.parse(saved);
        } catch (error: any) {
            console.error(`[${this.name}]`, 'Failed to parse', saved);
        }
        return parsedValue;
    }

    public static getVideoSettingFromStorage(
        preferred: VideoSettings,
        storageKeyPrefix: string,
        udid: string,
        displayInfo?: DisplayInfo,
    ): VideoSettings {
        if (!window.localStorage) {
            return preferred;
        }
        const saved = this.getFromStorageCompat(storageKeyPrefix, udid, displayInfo);
        if (!saved) {
            return preferred;
        }
        const parsed = JSON.parse(saved);
        const {
            displayId,
            crop,
            bitrate,
            iFrameInterval,
            sendFrameMeta,
            lockedVideoOrientation,
            codecOptions,
            encoderName,
        } = parsed;

        // REMOVE `frameRate`
        const maxFps = isNaN(parsed.maxFps) ? parsed.frameRate : parsed.maxFps;
        // REMOVE `maxSize`
        let bounds: Size | null = null;
        if (typeof parsed.bounds !== 'object' || isNaN(parsed.bounds.width) || isNaN(parsed.bounds.height)) {
            if (!isNaN(parsed.maxSize)) {
                bounds = new Size(parsed.maxSize, parsed.maxSize);
            }
        } else {
            bounds = new Size(parsed.bounds.width, parsed.bounds.height);
        }
        return new VideoSettings({
            displayId: typeof displayId === 'number' ? displayId : 0,
            crop: crop ? new Rect(crop.left, crop.top, crop.right, crop.bottom) : preferred.crop,
            bitrate: !isNaN(bitrate) ? bitrate : preferred.bitrate,
            bounds: bounds !== null ? bounds : preferred.bounds,
            maxFps: !isNaN(maxFps) ? maxFps : preferred.maxFps,
            iFrameInterval: !isNaN(iFrameInterval) ? iFrameInterval : preferred.iFrameInterval,
            sendFrameMeta: typeof sendFrameMeta === 'boolean' ? sendFrameMeta : preferred.sendFrameMeta,
            lockedVideoOrientation: !isNaN(lockedVideoOrientation)
                ? lockedVideoOrientation
                : preferred.lockedVideoOrientation,
            codecOptions,
            encoderName,
        });
    }

    protected static putVideoSettingsToStorage(
        storageKeyPrefix: string,
        udid: string,
        videoSettings: VideoSettings,
        fitToScreen: boolean,
        displayInfo?: DisplayInfo,
    ): void {
        if (!window.localStorage) {
            return;
        }
        const key = this.getFullStorageKey(storageKeyPrefix, udid, displayInfo);
        window.localStorage.setItem(key, JSON.stringify(videoSettings));
        const fitKey = `${key}:fit`;
        window.localStorage.setItem(fitKey, JSON.stringify(fitToScreen));
    }

    public abstract getImageDataURL(): string;

    public createScreenshot(deviceName: string): void {
        const a = document.createElement('a');
        a.href = this.getImageDataURL();
        a.download = `${deviceName} ${new Date().toLocaleString()}.png`;
        a.click();
    }

    public play(): void {
        if (this.needScreenInfoBeforePlay() && !this.screenInfo) {
            return;
        }
        this.state = BasePlayer.STATE.PLAYING;
    }

    public pause(): void {
        this.state = BasePlayer.STATE.PAUSED;
    }

    public stop(): void {
        this.state = BasePlayer.STATE.STOPPED;
    }

    public getState(): number {
        return this.state;
    }

    public pushFrame(frame: Uint8Array): void {
        if (!this.receivedFirstFrame) {
            this.receivedFirstFrame = true;
            if (typeof this.qualityAnimationId !== 'number') {
                this.qualityAnimationId = requestAnimationFrame(this.updateQualityStats);
            }
        }
        this.inputBytes.push({
            timestamp: Date.now(),
            bytes: frame.byteLength,
        });
    }

    public abstract getPreferredVideoSetting(): VideoSettings;
    protected abstract calculateMomentumStats(): void;

    public getTouchableElement(): HTMLCanvasElement {
        return this.touchableCanvas;
    }

    public setParent(parent: HTMLElement): void {
        this.parentElement = parent;
        parent.appendChild(this.tag);
        parent.appendChild(this.touchableCanvas);
    }

    protected needScreenInfoBeforePlay(): boolean {
        return true;
    }

    public getVideoSettings(): VideoSettings {
        return this.videoSettings;
    }

    public setVideoSettings(videoSettings: VideoSettings, fitToScreen: boolean, saveToStorage: boolean): void {
        this.videoSettings = videoSettings;
        if (saveToStorage) {
            BasePlayer.putVideoSettingsToStorage(
                this.storageKeyPrefix,
                this.udid,
                videoSettings,
                fitToScreen,
                this.displayInfo,
            );
        }
        this.resetStats();
        this.emit('video-settings', VideoSettings.copy(videoSettings));
    }

    public getScreenInfo(): ScreenInfo | undefined {
        return this.screenInfo;
    }

    public setScreenInfo(screenInfo: ScreenInfo): void {
        if (this.needScreenInfoBeforePlay()) {
            this.pause();
        }
        this.receivedFirstFrame = false;
        this.screenInfo = screenInfo;
        const { width, height } = screenInfo.videoSize;
        this.touchableCanvas.width = width;
        this.touchableCanvas.height = height;
        if (this.parentElement) {
            this.parentElement.style.height = `${height}px`;
            this.parentElement.style.width = `${width}px`;
        }
        const size = new Size(width, height);
        this.emit('video-view-resize', size);
    }

    public getName(): string {
        return this.name;
    }

    protected resetStats(): void {
        this.receivedFirstFrame = false;
        this.totalStatsCounter = 0;
        this.totalStats = {
            droppedFrames: 0,
            decodedFrames: 0,
            inputFrames: 0,
            inputBytes: 0,
            timestamp: 0,
        };
        this.perSecondQualityStats = {
            avgDecoded: 0,
            avgDropped: 0,
            avgInput: 0,
            avgSize: 0,
        };
    }

    private updateQualityStats = (): void => {
        const now = Date.now();
        const oneSecondBefore = now - 1000;
        this.calculateMomentumStats();
        if (!this.momentumQualityStats) {
            return;
        }
        if (this.totalStats.timestamp < oneSecondBefore) {
            this.totalStats = {
                timestamp: now,
                decodedFrames: this.totalStats.decodedFrames + this.momentumQualityStats.decodedFrames,
                droppedFrames: this.totalStats.droppedFrames + this.momentumQualityStats.droppedFrames,
                inputFrames: this.totalStats.inputFrames + this.momentumQualityStats.inputFrames,
                inputBytes: this.totalStats.inputBytes + this.momentumQualityStats.inputBytes,
            };

            if (this.totalStatsCounter !== 0) {
                this.perSecondQualityStats = {
                    avgDecoded: this.totalStats.decodedFrames / this.totalStatsCounter,
                    avgDropped: this.totalStats.droppedFrames / this.totalStatsCounter,
                    avgInput: this.totalStats.inputFrames / this.totalStatsCounter,
                    avgSize: this.totalStats.inputBytes / this.totalStatsCounter,
                };
            }
            this.totalStatsCounter++;
        }
        this.drawStats();
        if (this.state !== BasePlayer.STATE.STOPPED) {
            this.qualityAnimationId = requestAnimationFrame(this.updateQualityStats);
        }
    };

    private drawStats(): void {
        if (!this.showQualityStats) {
            return;
        }
        const ctx = this.touchableCanvas.getContext('2d');
        if (!ctx) {
            return;
        }
        const newStats = [];
        if (this.perSecondQualityStats && this.momentumQualityStats) {
            const { decodedFrames, droppedFrames, inputBytes, inputFrames } = this.momentumQualityStats;
            const { avgDecoded, avgDropped, avgSize, avgInput } = this.perSecondQualityStats;
            const padInput = inputFrames.toString().padStart(3, ' ');
            const padDecoded = decodedFrames.toString().padStart(3, ' ');
            const padDropped = droppedFrames.toString().padStart(3, ' ');
            const padAvgDecoded = avgDecoded.toFixed(1).padStart(5, ' ');
            const padAvgDropped = avgDropped.toFixed(1).padStart(5, ' ');
            const padAvgInput = avgInput.toFixed(1).padStart(5, ' ');
            const prettyBytes = Util.prettyBytes(inputBytes).padStart(8, ' ');
            const prettyAvgBytes = Util.prettyBytes(avgSize).padStart(8, ' ');

            newStats.push(`Input bytes: ${prettyBytes} (avg: ${prettyAvgBytes}/s)`);
            newStats.push(`Input   FPS: ${padInput} (avg: ${padAvgInput})`);
            newStats.push(`Dropped FPS: ${padDropped} (avg: ${padAvgDropped})`);
            newStats.push(`Decoded FPS: ${padDecoded} (avg: ${padAvgDecoded})`);
        } else {
            newStats.push(`Not supported`);
        }
        let changed = this.statLines.length !== newStats.length;
        let i = 0;
        while (!changed && i++ < newStats.length) {
            if (newStats[i] !== this.statLines[i]) {
                changed = true;
            }
        }

        if (changed) {
            this.statLines = newStats;
            this.updateCanvas(false);
        }
    }

    private updateCanvas(onlyClear: boolean): void {
        const ctx = this.touchableCanvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const y = this.touchableCanvas.height;
        const height = BasePlayer.STATS_HEIGHT;
        const lines = this.statLines.length;
        const spaces = lines + 1;
        const p = height / 2;
        const d = p * 2;
        const totalHeight = height * lines + p * spaces;

        ctx.clearRect(0, y - totalHeight, this.dirtyStatsWidth + d, totalHeight);
        this.dirtyStatsWidth = 0;

        if (onlyClear) {
            return;
        }
        ctx.save();
        ctx.font = `${height}px monospace`;
        this.statLines.forEach((text) => {
            const textMetrics = ctx.measureText(text);
            const dirty = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
            this.dirtyStatsWidth = Math.max(dirty, this.dirtyStatsWidth);
        });
        ctx.fillStyle = BasePlayer.STAT_BACKGROUND;
        ctx.fillRect(0, y - totalHeight, this.dirtyStatsWidth + d, totalHeight);
        ctx.fillStyle = BasePlayer.STAT_TEXT_COLOR;
        this.statLines.forEach((text, line) => {
            ctx.fillText(text, p, y - p - line * (height + p));
        });
        ctx.restore();
    }

    public setShowQualityStats(value: boolean): void {
        this.showQualityStats = value;
        if (!value) {
            this.updateCanvas(true);
        } else {
            this.drawStats();
        }
    }

    public getShowQualityStats(): boolean {
        return this.showQualityStats;
    }

    public setBounds(bounds: Size): void {
        this.bounds = Size.copy(bounds);
    }

    public getDisplayInfo(): DisplayInfo | undefined {
        return this.displayInfo;
    }

    public setDisplayInfo(displayInfo: DisplayInfo): void {
        this.displayInfo = displayInfo;
    }

    public abstract getFitToScreenStatus(): boolean;

    public abstract loadVideoSettings(): VideoSettings;

    public static loadVideoSettings(udid: string, displayInfo?: DisplayInfo): VideoSettings {
        return this.getVideoSettingFromStorage(this.preferredVideoSettings, this.storageKeyPrefix, udid, displayInfo);
    }

    public static getFitToScreenStatus(udid: string, displayInfo?: DisplayInfo): boolean {
        return this.getFitToScreenFromStorage(this.storageKeyPrefix, udid, displayInfo);
    }

    public static getPreferredVideoSetting(): VideoSettings {
        return this.preferredVideoSettings;
    }

    public static saveVideoSettings(
        udid: string,
        videoSettings: VideoSettings,
        fitToScreen: boolean,
        displayInfo?: DisplayInfo,
    ): void {
        this.putVideoSettingsToStorage(this.storageKeyPrefix, udid, videoSettings, fitToScreen, displayInfo);
    }
}
