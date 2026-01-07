import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Rect from '../Rect';
import Size from '../Size';
import Util from '../Util';
import { TypedEmitter } from '../../common/TypedEmitter';
import { DisplayInfo } from '../DisplayInfo';
import genericAndroid from "../../common/generic_android.png";

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
    protected loadingOverlay?: HTMLElement;
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
            this.touchableCanvas.style.maxWidth = "510px";
        else
            this.touchableCanvas.style.maxWidth = "78vw";


        const myInterval = setInterval(() => {
            if (tag.clientHeight || tag.clientWidth) {
                this.reOrientScreen();

                window.addEventListener('resize', () => {
                    this.reOrientScreen();
                });

                window.addEventListener('message', (e) => {
                    const allowedOrigins = [
                        "https://nativebridge.io",
                        "https://trust-me-bro.nativebridge.io",
                        "http://localhost:5173",
                    ];
                
                    const isAllowedOrigin = allowedOrigins.includes(e.origin) || e.origin.startsWith("vscode-webview://");

                    if (!isAllowedOrigin) {
                        console.warn("Blocked message from untrusted origin:", e.origin);
                        return; // Reject messages from untrusted origins
                    }
                    if(e.data.event === "screenshot"){
                        window.parent?.postMessage({ event: "screenshot", commentId: e.data.id, imageUrl: this.getImageDataURL() }, "*"); // Replace '*' with the specific origin for security
                    }
                    console.log("change theme ", e.data.theme);
                    if(e.data.event === "change-theme"){
                        if( e.data.theme === "dark" )
                            document.body.style.backgroundColor = "#1f2937";

                        else if( e.data.theme === "light" )
                            document.body.style.backgroundColor = "#f8fafc";
                    }
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

    protected sendDataToParent(rotation: boolean, aspectRatio: string, deviceType: string): void {
        // Send data to the parent window

        window.parent?.postMessage({ event: "device-rotation", rotation: rotation, aspectRatio, deviceType }, "*"); // Replace '*' with the specific origin for security
    }

    public reOrientScreen(invert: boolean = false, player: BasePlayer = this): void {

        let rotation = this.displayInfo?.rotation && this.displayInfo?.rotation !== 2 && this.displayInfo?.rotation !== 0 ? true : false;

        console.log("player info ", this.displayInfo, invert);
        player.touchableCanvas.style.zIndex = "20";
        
        const videoElem = document.getElementsByClassName("video-layer")[0] as HTMLElement;
        const touchElem = document.getElementsByClassName("touch-layer")[0] as HTMLElement;
        const aspectRatio = this.displayInfo ? this.displayInfo.size?.width / this.displayInfo.size?.height : "";

        const params = new URLSearchParams(window.location.search);
        const deviceType = params.get('deviceType') || "emulated";

        if (videoElem) {
            if (rotation) {
    
                if (window.innerWidth > 380){
                    videoElem.style.maxWidth = "910px";
                    if( deviceType == "emulated" ){
                        videoElem.style.width = "calc(100vw - 4.8rem)";
                        videoElem.style.borderRadius = "1.25rem";
                        videoElem.style.marginTop = "3.2%";
                        videoElem.style.marginLeft = "2%";
                    }
                }
                else{
                    
                    videoElem.style.width = "calc(100vw - 3rem)";
                    videoElem.style.maxWidth = "84vw";
                    if( deviceType == "emulated" ){
                        
                        videoElem.style.width = "calc(100vw - 4rem)";
                        videoElem.style.borderRadius = "1rem";
                        videoElem.style.marginTop = "3.2%";
                        videoElem.style.marginLeft = "2%";
                    }
                    else{
                        videoElem.style.width = "calc(100vw - 3rem)";

                    }
                }
            }
            else {

                videoElem.style.width = "calc(100vw - 3rem)";

                if (window.innerWidth > 380){

                    videoElem.style.maxWidth = "510px";
                    if( deviceType == "emulated" ){
                        
                        videoElem.style.width = "calc(100vw - 5.5rem)";
                        videoElem.style.marginTop = "3%";
                        videoElem.style.marginLeft = "4.5%";
                    }
                    else{
                        
                        videoElem.style.width = "calc(100vw - 3rem)";
                    }
                }
                else{

                    if( deviceType == "emulated" ){
                        
                        videoElem.style.maxWidth = "78vw";
                        videoElem.style.width = "calc(100vw - 4rem)";
                        videoElem.style.marginTop = "3%";
                        videoElem.style.marginLeft = "4.2%";
                    }
                    else{
                        
                        videoElem.style.maxWidth = "90vw";
                        videoElem.style.width = "calc(100vw - 3rem)";
                    }
                }
            }

            if( aspectRatio ){
                console.log("asdf ", videoElem.clientWidth, videoElem.clientHeight, aspectRatio)
                // videoElem.style.height = (videoElem.clientWidth / aspectRatio) + "px";
            }
        }
        if (touchElem) {
            if (rotation) {
                
                if (window.innerWidth > 380){
                    touchElem.style.maxWidth = "910px";
                    if( deviceType == "emulated" ){
                        
                        touchElem.style.width = "calc(100vw - 4.8rem)";
                        touchElem.style.borderRadius = "1.5rem";
                        touchElem.style.marginTop = "3.2%";
                        touchElem.style.marginLeft = "2%";
                    }
                    else{

                        touchElem.style.width = "calc(100vw - 3rem)";
                    }
                }
                else{
                    
                    if( deviceType == "emulated" ){
                        
                        touchElem.style.maxWidth = "84vw";
                        touchElem.style.width = "calc(100vw - 4rem)";
                        touchElem.style.borderRadius = "1rem";
                        touchElem.style.marginTop = "3.2%";
                        touchElem.style.marginLeft = "2%";
                    }
                    else{
                        
                        touchElem.style.maxWidth = "90vw";
                        touchElem.style.width = "calc(100vw - 3rem)";
                    }
                }  
            }
            else {

                if (window.innerWidth > 380){
                    touchElem.style.maxWidth = "510px";
                    if( deviceType == "emulated" ){
                        
                        touchElem.style.width = "calc(100vw - 5.5rem)";
                        touchElem.style.marginTop = "3%";
                        touchElem.style.marginLeft = "4.5%";
                    }
                    else{

                        touchElem.style.width = "calc(100vw - 3rem)";
                    }
                }
                else{
                    
                    if( deviceType == "emulated" ){
                        
                        touchElem.style.width = "calc(100vw - 4rem)";
                        touchElem.style.maxWidth = "78vw";
                        touchElem.style.marginTop = "3%";
                        touchElem.style.marginLeft = "4.2%";
                    }
                    else{

                        touchElem.style.width = "calc(100vw - 3rem)";
                        touchElem.style.maxWidth = "90vw";
                    }
                }
            }
            // if( aspectRatio )
            //     touchElem.style.height = (touchElem.clientWidth / aspectRatio) + "px"
        }

        const width = touchElem.clientWidth;
        let height = touchElem.clientHeight;
        
        if( aspectRatio )
            height = width / aspectRatio;

        const videoElemParent = document.getElementsByClassName("video")[0] as HTMLElement;
        const videoElemParentParent = document.getElementsByClassName("device-view")[0] as HTMLElement;
        videoElemParent.style.maxWidth = "none";
        videoElemParentParent.style.maxWidth = "none";
        videoElemParentParent.style.float = "none";
        
        let androidFrame = document.getElementById("generic-android-mockup") as HTMLImageElement;

        console.log("androidFrame ", androidFrame?.clientWidth, androidFrame?.clientHeight, rotation, height, width, touchElem?.clientHeight, touchElem?.clientWidth, touchElem?.clientHeight, videoElem?.clientHeight, videoElem?.clientWidth);
        
        if( !androidFrame ){
            androidFrame = document.createElement("img");
            androidFrame.src = genericAndroid;
            androidFrame.id = "generic-android-mockup";
            androidFrame.style.height = "";
        }

        if (androidFrame) {

            androidFrame.style.aspectRatio = "auto";
            if (rotation) {

                androidFrame.style.aspectRatio="auto";

                if( width < height ){
                    if( window.innerWidth > 380 )
                        androidFrame.style.maxWidth = "910px";
                    else
                        androidFrame.style.maxWidth = "84vw";

                    return;
                }
                else
                    androidFrame.style.maxWidth = "none";
                androidFrame.style.transform = "rotateZ(-90deg)";
                androidFrame.style.transformOrigin = Math.abs( (height*1.11) / 2) + "px " + Math.abs( (height*1.11) / 2) + "px";
                androidFrame.style.height = (width*1.04) + "px";
                androidFrame.style.width = (height*1.11) + "px";
                if( deviceType == "emulated" ){
                    
                    videoElemParentParent.style.width = (width*1.04 + 34) + "px";
                    videoElemParent.style.width = (width*1.04 + 34) + "px";
                    androidFrame.style.marginTop = "0px";
                    androidFrame.style.marginLeft = "0px";
                }
                else{
                    videoElemParent.style.width = (width + 34) + "px"
                    videoElemParentParent.style.width = (width + 34) + "px";
                    videoElemParent.style.height = (height + 34) + "px"
                    videoElemParentParent.style.height = (height + 34) + "px";

                }

            }
            else {
                if( width > height ){
                    if( window.innerWidth > 380 )
                        androidFrame.style.maxWidth = "510px";
                    else
                        androidFrame.style.maxWidth = "78vw";

                    return;
                }
                else
                    androidFrame.style.maxWidth = "none";
                androidFrame.style.transform = "";
                androidFrame.style.transformOrigin = Math.abs((width*1.04) / 2) + "px " + Math.abs((width*1.04) / 2) + "px";
                androidFrame.style.width = (width*1.1) + "px";
                androidFrame.style.height = (height*1.03) + "px";
                if( deviceType == "emulated"){
                    videoElemParent.style.height = (height*1.03) + "px";
                    videoElemParent.style.width = (width*1.11 + 34) + "px";
                    androidFrame.style.marginTop = "0px";
                    androidFrame.style.marginLeft = "0px";
                    videoElemParentParent.style.width = (width*1.11 + 34) + "px";
                    videoElemParentParent.style.height = (height*1.03) + "px";
                }
                else{
                    videoElemParentParent.style.width = (width + 34) + "px";
                    videoElemParentParent.style.height = (height) + "px";
                    videoElemParent.style.width = (width + 34) + "px";
                    videoElemParent.style.height = height + "px";

                }
            }

            const androidMockFrame = document.getElementById("generic-android-mockup") as HTMLImageElement;
            console.log("androidMockFrame ", height, videoElem.clientHeight);
            if( !androidMockFrame && deviceType == "emulated" ){
                videoElemParent.appendChild(androidFrame);
            }

            const aspectRatio = videoElemParentParent.clientWidth + "/" + (rotation ? 
                deviceType == "emulated" ? androidFrame.clientWidth 
                    : height
                : deviceType == "emulated" ? videoElemParent.clientHeight
                    : height);

            this.sendDataToParent(rotation, aspectRatio, deviceType);
        }
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

        // Create and add Android-themed loading overlay
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'video-loading-overlay';

        // Android robot icon
        const androidIcon = document.createElement('div');
        androidIcon.className = 'video-loading-android';
        androidIcon.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
        </svg>`;

        // Material Design circular spinner
        const spinner = document.createElement('div');
        spinner.className = 'video-loading-spinner';
        spinner.innerHTML = `<svg viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
        </svg>`;

        // Loading text
        const loadingText = document.createElement('div');
        loadingText.className = 'video-loading-text';
        loadingText.textContent = 'Connecting';

        this.loadingOverlay.appendChild(androidIcon);
        this.loadingOverlay.appendChild(spinner);
        this.loadingOverlay.appendChild(loadingText);
        parent.appendChild(this.loadingOverlay);
    }

    public hideLoadingOverlay(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('hidden');
            // Remove from DOM after transition completes
            setTimeout(() => {
                if (this.loadingOverlay && this.loadingOverlay.parentElement) {
                    this.loadingOverlay.parentElement.removeChild(this.loadingOverlay);
                    this.loadingOverlay = undefined;
                }
            }, 300);
        }
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
