import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import Rect from '../Rect';
import Size from '../Size';
import Util from '../Util';
import { TypedEmitter } from '../../common/TypedEmitter';
import { DisplayInfo } from '../DisplayInfo';
import genericAndroid from '../../common/generic_android.png';

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
    new (udid: string, displayInfo?: DisplayInfo): BasePlayer;
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

    // Zoom state
    private zoomLevel: number = 1.0;
    private phoneContainer?: HTMLElement;
    private readonly MIN_ZOOM = 0.5;
    private readonly MAX_ZOOM = 2.0;
    private readonly ZOOM_STEP = 0.1;

    // UI rotation state (0, 90, 180, 270 degrees)
    private uiRotation: number = 0;

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
        this.touchableCanvas.style.width = 'calc(100vw - 3rem)';
        if (window.innerWidth > 380) this.touchableCanvas.style.maxWidth = '510px';
        else this.touchableCanvas.style.maxWidth = '78vw';

        const myInterval = setInterval(() => {
            if (tag.clientHeight || tag.clientWidth) {
                this.reOrientScreen();

                window.addEventListener('resize', () => {
                    this.reOrientScreen();
                });

                window.addEventListener('message', (e) => {
                    const allowedOrigins = [
                        'https://nativebridge.io',
                        'https://trust-me-bro.nativebridge.io',
                        'http://localhost:5173',
                    ];

                    const isAllowedOrigin =
                        allowedOrigins.includes(e.origin) || e.origin.startsWith('vscode-webview://');

                    if (!isAllowedOrigin) {
                        console.warn('Blocked message from untrusted origin:', e.origin);
                        return; // Reject messages from untrusted origins
                    }
                    if (e.data.event === 'screenshot') {
                        window.parent?.postMessage(
                            { event: 'screenshot', commentId: e.data.id, imageUrl: this.getImageDataURL() },
                            '*',
                        ); // Replace '*' with the specific origin for security
                    }
                    console.log('change theme ', e.data.theme);
                    if (e.data.event === 'change-theme') {
                        if (e.data.theme === 'dark') document.body.style.backgroundColor = '#1f2937';
                        else if (e.data.theme === 'light') document.body.style.backgroundColor = '#f8fafc';
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

        window.parent?.postMessage({ event: 'device-rotation', rotation: rotation, aspectRatio, deviceType }, '*'); // Replace '*' with the specific origin for security
    }

    public reOrientScreen(_invert: boolean = false, player: BasePlayer = this): void {
        player.touchableCanvas.style.zIndex = '20';

        const videoElem = document.getElementsByClassName('video-layer')[0] as HTMLElement;
        const touchElem = document.getElementsByClassName('touch-layer')[0] as HTMLElement;
        const videoWrapper = document.getElementsByClassName('video')[0] as HTMLElement;
        const deviceView = document.getElementsByClassName('device-view')[0] as HTMLElement;

        if (!videoElem || !touchElem || !videoWrapper || !deviceView) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const deviceType = params.get('deviceType') || 'emulated';

        // Get video dimensions from screenInfo (actual video stream size) or displayInfo as fallback
        let deviceWidth: number;
        let deviceHeight: number;

        if (this.screenInfo?.videoSize) {
            // Use actual video stream dimensions - this is the most accurate
            deviceWidth = this.screenInfo.videoSize.width;
            deviceHeight = this.screenInfo.videoSize.height;
        } else if (this.displayInfo?.size) {
            deviceWidth = this.displayInfo.size.width;
            deviceHeight = this.displayInfo.size.height;
        } else {
            deviceWidth = 1080;
            deviceHeight = 1920;
        }

        // Determine if device video is in landscape (width > height)
        const rotation = deviceWidth > deviceHeight;

        // Check if UI rotation swaps the visible aspect ratio (90 or 270 degrees)
        const isUIRotated = this.uiRotation === 90 || this.uiRotation === 270;

        // Content aspect ratio (what we render)
        const contentAspectRatio = deviceWidth / deviceHeight;

        // Visible aspect ratio (how it appears after UI rotation)
        const visibleAspectRatio = isUIRotated ? 1 / contentAspectRatio : contentAspectRatio;
        const isLandscapeVisible = visibleAspectRatio > 1;

        // Responsive breakpoints
        const isMobile = window.innerWidth < 600;
        const isTablet = window.innerWidth >= 600 && window.innerWidth < 1024;

        // Calculate available space (accounting for control panel)
        // On mobile, control panel floats over content so don't deduct its width
        const controlPanel = document.getElementsByClassName('control-buttons-list')[0] as HTMLElement;
        const controlPanelWidth = isMobile ? 0 : Math.max(controlPanel?.offsetWidth || 0, 50) + 24;

        // Responsive padding - much less on mobile to maximize phone size
        let horizontalPadding: number;
        let verticalPadding: number;

        if (isMobile) {
            horizontalPadding = 16;
            verticalPadding = 16;
        } else if (isTablet) {
            horizontalPadding = isLandscapeVisible ? 40 : 24;
            verticalPadding = isLandscapeVisible ? 32 : 24;
        } else {
            // Desktop - more padding for landscape to ensure phone doesn't overflow
            horizontalPadding = isLandscapeVisible ? 80 : 48;
            verticalPadding = isLandscapeVisible ? 48 : 32;
        }

        let availableWidth = window.innerWidth - controlPanelWidth - horizontalPadding;
        let availableHeight = window.innerHeight - verticalPadding;

        // Minimum size constraints to prevent phone from getting too small
        const minWidth = isLandscapeVisible ? 280 : 160;
        const minHeight = isLandscapeVisible ? 180 : 240;

        // Maximum size constraints - more generous on mobile/tablet
        let maxWidth: number;
        let maxHeight: number;

        if (isMobile) {
            // On mobile, allow phone to fill most of the screen
            maxWidth = availableWidth;
            maxHeight = availableHeight;
        } else if (isTablet) {
            maxWidth = isLandscapeVisible ? Math.min(availableWidth, 800) : Math.min(availableWidth, 450);
            maxHeight = isLandscapeVisible ? Math.min(availableHeight, 450) : Math.min(availableHeight, 750);
        } else {
            // Desktop
            maxWidth = isLandscapeVisible ? Math.min(availableWidth, 900) : Math.min(availableWidth, 500);
            maxHeight = isLandscapeVisible ? Math.min(availableHeight, 500) : Math.min(availableHeight, 850);
        }

        availableWidth = Math.max(minWidth, Math.min(availableWidth, maxWidth));
        availableHeight = Math.max(minHeight, Math.min(availableHeight, maxHeight));

        // Calculate optimal dimensions based on VISIBLE aspect ratio (after rotation)
        let visibleWidth: number;
        let visibleHeight: number;

        if (availableWidth / availableHeight > visibleAspectRatio) {
            // Height constrained
            visibleHeight = availableHeight;
            visibleWidth = visibleHeight * visibleAspectRatio;
        } else {
            // Width constrained
            visibleWidth = availableWidth;
            visibleHeight = visibleWidth / visibleAspectRatio;
        }

        // Content dimensions (before CSS rotation)
        // When UI is rotated 90/270, the content width/height are swapped from visible
        let contentWidth: number;
        let contentHeight: number;
        if (isUIRotated) {
            contentWidth = visibleHeight; // Rotated: visible height becomes content width
            contentHeight = visibleWidth; // Rotated: visible width becomes content height
        } else {
            contentWidth = visibleWidth;
            contentHeight = visibleHeight;
        }

        // Apply zoom level
        const scaledWidth = contentWidth * this.zoomLevel;
        const scaledHeight = contentHeight * this.zoomLevel;

        // Apply styles to video and touch layers
        const widthPx = `${scaledWidth}px`;
        const heightPx = `${scaledHeight}px`;

        // Reset all hardcoded styles
        videoElem.style.width = widthPx;
        videoElem.style.height = heightPx;
        videoElem.style.maxWidth = 'none';
        videoElem.style.marginTop = '0';
        videoElem.style.marginLeft = '0';
        videoElem.style.borderRadius = '1.5rem';

        touchElem.style.width = widthPx;
        touchElem.style.height = heightPx;
        touchElem.style.maxWidth = 'none';
        touchElem.style.marginTop = '0';
        touchElem.style.marginLeft = '0';
        touchElem.style.borderRadius = '1.5rem';

        // Handle phone container if it exists
        if (this.phoneContainer) {
            this.phoneContainer.style.width = widthPx;
            this.phoneContainer.style.height = heightPx;
            this.phoneContainer.style.position = 'relative';
            // Reset any positioning that might affect centering
            this.phoneContainer.style.margin = '0';
            this.phoneContainer.style.left = '';
            this.phoneContainer.style.top = '';
        }

        // Frame multipliers - defined at higher scope for wrapper sizing
        // The frame PNG is designed for portrait, so we need to handle landscape differently
        const frameWidthMultiplier = 1.08;
        const frameHeightMultiplier = 1.04;

        // Handle android mockup frame - append to phoneContainer so it positions correctly
        let androidFrame = document.getElementById('generic-android-mockup') as HTMLImageElement;
        const phoneContainer =
            this.phoneContainer || (document.getElementsByClassName('phone-container')[0] as HTMLElement);

        // Show frame for all devices (previously only for emulated)
        // if (!androidFrame && deviceType === 'emulated' && phoneContainer) {
        if (!androidFrame && phoneContainer) {
            androidFrame = document.createElement('img');
            androidFrame.src = genericAndroid;
            androidFrame.id = 'generic-android-mockup';
            androidFrame.style.position = 'absolute';
            androidFrame.style.pointerEvents = 'none';
            androidFrame.style.zIndex = '0'; // Behind video/touch layers
            phoneContainer.appendChild(androidFrame);
        }

        if (androidFrame) {
            // Scale the frame to wrap around the video

            let frameWidth: number;
            let frameHeight: number;
            let frameOffsetX: number;
            let frameOffsetY: number;

            if (rotation) {
                // Device is in landscape mode - frame needs to be created in portrait then rotated
                // The frame PNG has thicker bezels on top/bottom (designed for portrait)
                // When rotated 90°, those thick bezels become left/right sides
                // So we need to swap multipliers:
                // - frameWidth (becomes visual height) should use width multiplier (thicker bezel = 1.08)
                // - frameHeight (becomes visual width) should use height multiplier (thinner bezel = 1.04)
                frameWidth = scaledHeight * frameWidthMultiplier; // This becomes visual height (thick bezels on top/bottom)
                frameHeight = scaledWidth * frameHeightMultiplier; // This becomes visual width (thin bezels on sides)

                androidFrame.style.width = `${frameWidth}px`;
                androidFrame.style.height = `${frameHeight}px`;
                androidFrame.style.maxWidth = 'none';

                // Rotate frame 90° to match landscape video
                androidFrame.style.transform = 'rotateZ(-90deg)';
                // Transform origin needs to account for the rotation pivot
                androidFrame.style.transformOrigin = `${frameWidth / 2}px ${frameWidth / 2}px`;

                // After rotation: visual width = frameHeight, visual height = frameWidth
                const visualFrameWidth = frameHeight;
                const visualFrameHeight = frameWidth;
                frameOffsetX = (visualFrameWidth - scaledWidth) / 2;
                frameOffsetY = (visualFrameHeight - scaledHeight) / 2;
            } else {
                // Portrait mode - straightforward
                frameWidth = scaledWidth * frameWidthMultiplier;
                frameHeight = scaledHeight * frameHeightMultiplier;

                androidFrame.style.width = `${frameWidth}px`;
                androidFrame.style.height = `${frameHeight}px`;
                androidFrame.style.maxWidth = 'none';
                androidFrame.style.transform = '';
                androidFrame.style.transformOrigin = 'center center';

                frameOffsetX = (frameWidth - scaledWidth) / 2;
                frameOffsetY = (frameHeight - scaledHeight) / 2;
            }

            // Show frame for all devices (previously only emulated)
            // if (deviceType === 'emulated') {
            // Center the frame around the video content
            androidFrame.style.left = `${-frameOffsetX}px`;
            androidFrame.style.top = `${-frameOffsetY}px`;
            androidFrame.style.display = 'block';

            // No margin adjustments needed - video stays at origin
            videoElem.style.marginTop = '0';
            videoElem.style.marginLeft = '0';
            touchElem.style.marginTop = '0';
            touchElem.style.marginLeft = '0';
            // } else {
            //     androidFrame.style.display = 'none';
            // }
        }

        // Set wrapper dimensions based on VISIBLE size (after UI rotation)
        const scaledVisibleWidth = visibleWidth * this.zoomLevel;
        const scaledVisibleHeight = visibleHeight * this.zoomLevel;

        // Calculate wrapper size to accommodate frame
        // Now showing frame for all devices (previously only emulated)
        let wrapperWidth: number;
        let wrapperHeight: number;
        // if (deviceType === 'emulated') {
        if (rotation) {
            // In device landscape (auto-rotate): frame is rotated, so its visual dimensions are swapped
            // frameWidth = scaledHeight * 1.08 becomes visual height
            // frameHeight = scaledWidth * 1.04 becomes visual width
            wrapperWidth = scaledVisibleWidth * frameHeightMultiplier;
            wrapperHeight = scaledVisibleHeight * frameWidthMultiplier;
        } else if (isUIRotated) {
            // Manual rotation: phone container is rotated, frame stays portrait
            // Visual dimensions after container rotation swap
            wrapperWidth = scaledVisibleWidth * frameHeightMultiplier;
            wrapperHeight = scaledVisibleHeight * frameWidthMultiplier;
        } else {
            // Portrait mode: frame is portrait
            wrapperWidth = scaledVisibleWidth * frameWidthMultiplier;
            wrapperHeight = scaledVisibleHeight * frameHeightMultiplier;
        }
        // } else {
        //     wrapperWidth = scaledVisibleWidth;
        //     wrapperHeight = scaledVisibleHeight;
        // }

        videoWrapper.style.width = `${wrapperWidth}px`;
        videoWrapper.style.height = `${wrapperHeight}px`;
        videoWrapper.style.maxWidth = 'none';
        videoWrapper.style.maxHeight = 'none';
        // Reset any positioning that might affect centering
        videoWrapper.style.margin = '0'; // Let flexbox handle centering
        videoWrapper.style.position = 'relative';
        videoWrapper.style.flex = 'none'; // Override CSS flex: 1 to respect explicit width
        videoWrapper.style.display = 'flex';
        videoWrapper.style.justifyContent = 'center';
        videoWrapper.style.alignItems = 'center';
        // Clear any leftover transform/position styles
        videoWrapper.style.transform = '';
        videoWrapper.style.left = '';
        videoWrapper.style.top = '';

        // Center the device view using flexbox
        deviceView.style.width = '100%';
        deviceView.style.height = '100vh';
        deviceView.style.maxWidth = 'none';
        deviceView.style.float = 'none';
        deviceView.style.display = 'flex';
        deviceView.style.flexDirection = 'row';
        deviceView.style.justifyContent = 'center';
        deviceView.style.alignItems = 'center';
        deviceView.style.overflow = 'auto'; // Allow scrolling when zoomed phone exceeds viewport

        // Send data to parent window
        const aspectRatioStr = `${Math.round(wrapperWidth)}/${Math.round(wrapperHeight)}`;
        this.sendDataToParent(rotation, aspectRatioStr, deviceType);
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
        // Note: Loading overlay is added by StreamClientScrcpy before this is called
    }

    public hideLoadingOverlay(): void {
        // Hide the video loading overlay when video is ready
        const overlay = document.querySelector('.video-loading-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.classList.add('hidden');
            setTimeout(() => {
                if (overlay.parentElement) {
                    overlay.parentElement.removeChild(overlay);
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
        const oldScreenInfo = this.screenInfo;
        this.screenInfo = screenInfo;
        const { width, height } = screenInfo.videoSize;
        this.touchableCanvas.width = width;
        this.touchableCanvas.height = height;
        // Don't set parentElement dimensions directly - let reOrientScreen handle it
        const size = new Size(width, height);
        this.emit('video-view-resize', size);

        // Re-orient screen when video dimensions change (e.g., device rotation)
        const dimensionsChanged =
            !oldScreenInfo || oldScreenInfo.videoSize.width !== width || oldScreenInfo.videoSize.height !== height;
        if (dimensionsChanged) {
            this.reOrientScreen();
        }
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

    // Zoom methods
    public setPhoneContainer(container: HTMLElement): void {
        this.phoneContainer = container;
        this.applyZoom();
    }

    public getPhoneContainer(): HTMLElement | undefined {
        return this.phoneContainer;
    }

    public zoomIn(): void {
        this.setZoom(Math.min(this.zoomLevel + this.ZOOM_STEP, this.MAX_ZOOM));
    }

    public zoomOut(): void {
        this.setZoom(Math.max(this.zoomLevel - this.ZOOM_STEP, this.MIN_ZOOM));
    }

    public resetZoom(): void {
        this.setZoom(1.0);
    }

    public getZoom(): number {
        return this.zoomLevel;
    }

    public setZoom(level: number): void {
        this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(level, this.MAX_ZOOM));
        this.applyZoom();
    }

    private applyZoom(): void {
        this.applyTransforms();
        this.reOrientScreen();
    }

    // UI Rotation methods - rotates the display anticlockwise by 90 degrees
    public rotateScreen(): void {
        this.uiRotation = (this.uiRotation + 90) % 360;
        this.applyTransforms();
        this.reOrientScreen();
    }

    public getUIRotation(): number {
        return this.uiRotation;
    }

    public resetRotation(): void {
        this.uiRotation = 0;
        this.applyTransforms();
        this.reOrientScreen();
    }

    private applyTransforms(): void {
        if (this.phoneContainer) {
            const transforms: string[] = [];
            if (this.zoomLevel !== 1.0) {
                transforms.push(`scale(${this.zoomLevel})`);
            }
            if (this.uiRotation !== 0) {
                transforms.push(`rotate(${-this.uiRotation}deg)`);
            }
            this.phoneContainer.style.transform = transforms.length > 0 ? transforms.join(' ') : '';
        }
    }
}
