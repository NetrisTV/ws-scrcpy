import { BaseClient } from './BaseClient';
import { ScrcpyStreamParams } from '../../common/ScrcpyStreamParams';
import { DroidMoreBox } from '../toolbox/DroidMoreBox';
import { DroidToolBox } from '../toolbox/DroidToolBox';
import VideoSettings from '../VideoSettings';
import Size from '../Size';
import { ControlMessage } from '../controlMessage/ControlMessage';
import { ClientsStats, DisplayCombinedInfo, StreamReceiver } from './StreamReceiver';
import { CommandControlMessage } from '../controlMessage/CommandControlMessage';
import Util from '../Util';
import FilePushHandler from '../FilePushHandler';
import DragAndPushLogger from '../DragAndPushLogger';
import { KeyEventListener, KeyInputHandler } from '../KeyInputHandler';
import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import { BasePlayer, PlayerClass } from '../player/BasePlayer';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import { ConfigureScrcpy, ConfigureScrcpyOptions } from './ConfigureScrcpy';
import { DeviceTrackerDroid } from './DeviceTrackerDroid';
import { DeviceTrackerCommand } from '../../common/DeviceTrackerCommand';
import { html } from '../ui/HtmlTag';
import { FeaturedTouchHandler, TouchHandlerListener } from '../touchHandler/FeaturedTouchHandler';
import DeviceMessage from '../DeviceMessage';
import { DisplayInfo } from '../DisplayInfo';

type StartParams = {
    udid: string;
    playerName: string | BasePlayer;
    fitToScreen?: boolean;
    videoSettings?: VideoSettings;
};

const ATTRIBUTE_UDID = 'data-udid';
const ATTRIBUTE_COMMAND = 'data-command';
const TAG = '[StreamClientScrcpy]';

export class StreamClientScrcpy extends BaseClient<never> implements KeyEventListener, TouchHandlerListener {
    public static ACTION: ScrcpyStreamParams['action'] = 'stream';
    private static players: Map<string, PlayerClass> = new Map<string, PlayerClass>();
    private static configureDialog?: ConfigureScrcpy;

    private controlButtons?: HTMLElement;
    private deviceName = '';
    private clientId = -1;
    private clientsCount = -1;
    private joinedStream = false;
    private requestedVideoSettings?: VideoSettings;
    private touchHandler?: FeaturedTouchHandler;
    private droidMoreBox?: DroidMoreBox;
    private player?: BasePlayer;
    private filePushHandler?: FilePushHandler;

    public static registerPlayer(playerClass: PlayerClass): void {
        if (playerClass.isSupported()) {
            this.players.set(playerClass.playerFullName, playerClass);
        }
    }

    public static getPlayers(): PlayerClass[] {
        return Array.from(this.players.values());
    }

    public static createPlayer(playerName: string, udid: string, displayInfo?: DisplayInfo): BasePlayer | undefined {
        let playerClass: PlayerClass | undefined;
        for (const value of StreamClientScrcpy.players.values()) {
            if (value.playerFullName === playerName || value.playerCodeName === playerName) {
                playerClass = value;
            }
        }
        if (!playerClass) {
            return;
        }
        return new playerClass(udid, displayInfo);
    }

    // TODO: remove deprecated method
    public static createFromParam({ udid, player, decoder, ip, port, query }: ScrcpyStreamParams): StreamClientScrcpy {
        const streamReceiver = new StreamReceiver(ip, port, query);
        const playerName: string = typeof player === 'string' ? player : (decoder as string);
        const client = new StreamClientScrcpy(streamReceiver);
        const fitIntoScreen = true;
        client.startStream({ udid, playerName, fitToScreen: fitIntoScreen });
        return client;
    }

    public static createWithReceiver(streamReceiver: StreamReceiver, params: StartParams): StreamClientScrcpy {
        const client = new StreamClientScrcpy(streamReceiver);
        client.startStream(params);
        return client;
    }

    protected constructor(private readonly streamReceiver: StreamReceiver) {
        super();

        this.setBodyClass('stream');
    }

    public OnDeviceMessage = (message: DeviceMessage): void => {
        if (this.droidMoreBox) {
            this.droidMoreBox.OnDeviceMessage(message);
        }
    };

    public onVideo = (data: ArrayBuffer): void => {
        if (!this.player) {
            return;
        }
        const STATE = BasePlayer.STATE;
        if (this.player.getState() === STATE.PAUSED) {
            this.player.play();
        }
        if (this.player.getState() === STATE.PLAYING) {
            this.player.pushFrame(new Uint8Array(data));
        }
    };

    public onClientsStats = (stats: ClientsStats): void => {
        this.deviceName = stats.deviceName;
        this.clientId = stats.clientId;
        this.setTitle(`Stream ${this.deviceName}`);
    };

    public onDisplayInfo = (infoArray: DisplayCombinedInfo[]): void => {
        if (!this.player) {
            return;
        }
        const currentSettings = this.player.getVideoSettings();
        const displayId = currentSettings.displayId;
        const info = infoArray.find((value) => {
            return value.displayInfo.displayId === displayId;
        });
        if (!info) {
            return;
        }
        if (this.player.getState() === BasePlayer.STATE.PAUSED) {
            this.player.play();
        }
        const { videoSettings, screenInfo } = info;
        if (!videoSettings || !screenInfo) {
            this.joinedStream = true;
            this.sendMessage(CommandControlMessage.createSetVideoSettingsCommand(currentSettings));
            return;
        }

        this.clientsCount = info.connectionCount;
        let min = VideoSettings.copy(videoSettings);
        const oldInfo = this.player.getScreenInfo();
        if (!screenInfo.equals(oldInfo)) {
            this.player.setScreenInfo(screenInfo);
        }

        if (!videoSettings.equals(currentSettings)) {
            this.applyNewVideoSettings(videoSettings, videoSettings.equals(this.requestedVideoSettings));
        }
        if (!oldInfo) {
            const bounds = currentSettings.bounds;
            const videoSize: Size = screenInfo.videoSize;
            const onlyOneClient = this.clientsCount === 0;
            const smallerThenCurrent = bounds && (bounds.width < videoSize.width || bounds.height < videoSize.height);
            if (onlyOneClient || smallerThenCurrent) {
                min = currentSettings;
            }
            const minBounds = currentSettings.bounds?.intersect(min.bounds);
            if (minBounds && !minBounds.equals(min.bounds)) {
                min = new VideoSettings({
                    crop: min.crop,
                    bitrate: min.bitrate,
                    bounds: minBounds,
                    maxFps: min.maxFps,
                    iFrameInterval: min.iFrameInterval,
                    sendFrameMeta: min.sendFrameMeta,
                    lockedVideoOrientation: min.lockedVideoOrientation,
                    displayId: min.displayId,
                    codecOptions: min.codecOptions,
                    encoderName: min.encoderName,
                });
            }
        }
        if (!min.equals(videoSettings) || !this.joinedStream) {
            this.joinedStream = true;
            this.sendMessage(CommandControlMessage.createSetVideoSettingsCommand(min));
        }
    };

    public onDisconnected = (): void => {
        this.streamReceiver.off('deviceMessage', this.OnDeviceMessage);
        this.streamReceiver.off('video', this.onVideo);
        this.streamReceiver.off('clientsStats', this.onClientsStats);
        this.streamReceiver.off('displayInfo', this.onDisplayInfo);
        this.streamReceiver.off('disconnected', this.onDisconnected);

        this.filePushHandler?.release();
        this.filePushHandler = undefined;
        this.touchHandler?.release();
        this.touchHandler = undefined;
    };

    public startStream({ udid, playerName, videoSettings, fitToScreen }: StartParams): void {
        if (!udid) {
            return;
        }

        let player: BasePlayer;
        if (typeof playerName === 'string') {
            let displayInfo: DisplayInfo | undefined;
            if (this.streamReceiver && videoSettings) {
                displayInfo = this.streamReceiver.getDisplayInfo(videoSettings.displayId);
            }
            const p = StreamClientScrcpy.createPlayer(playerName, udid, displayInfo);
            if (!p) {
                throw Error(`Unsupported player: "${playerName}"`);
            }
            player = p;
        } else {
            player = playerName;
        }
        this.player = player;
        this.setTouchListeners(player);

        if (!videoSettings) {
            videoSettings = player.getVideoSettings();
        }

        const deviceView = document.createElement('div');
        deviceView.className = 'device-view';
        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(TAG, ev);
            }
            let parent;
            parent = deviceView.parentElement;
            if (parent) {
                parent.removeChild(deviceView);
            }
            parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            this.streamReceiver.stop();
            player.stop();
        };

        const droidMoreBox = (this.droidMoreBox = new DroidMoreBox(udid, player, this));
        const moreBox = droidMoreBox.getHolderElement();
        droidMoreBox.setOnStop(stop);
        const droidToolBox = DroidToolBox.createToolBox(udid, player, this, moreBox);
        this.controlButtons = droidToolBox.getHolderElement();
        deviceView.appendChild(this.controlButtons);
        const video = document.createElement('div');
        video.className = 'video';
        deviceView.appendChild(video);
        deviceView.appendChild(moreBox);
        player.setParent(video);
        player.pause();

        document.body.appendChild(deviceView);
        if (fitToScreen) {
            const bounds = this.getMaxSize();
            const { bitrate, maxFps, iFrameInterval, lockedVideoOrientation, sendFrameMeta } = videoSettings;
            videoSettings = new VideoSettings({
                bounds,
                bitrate,
                maxFps,
                iFrameInterval,
                lockedVideoOrientation,
                sendFrameMeta,
            });
        }
        this.applyNewVideoSettings(videoSettings, false);
        const element = player.getTouchableElement();
        const logger = new DragAndPushLogger(element);
        this.filePushHandler = new FilePushHandler(element, this.streamReceiver);
        this.filePushHandler.addEventListener(logger);

        const streamReceiver = this.streamReceiver;
        streamReceiver.on('deviceMessage', this.OnDeviceMessage);
        streamReceiver.on('video', this.onVideo);
        streamReceiver.on('clientsStats', this.onClientsStats);
        streamReceiver.on('displayInfo', this.onDisplayInfo);
        streamReceiver.on('disconnected', this.onDisconnected);
        console.log(TAG, player.getName(), udid);
    }

    public sendMessage(e: ControlMessage): void {
        this.streamReceiver.sendEvent(e);
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public setHandleKeyboardEvents(enabled: boolean): void {
        if (enabled) {
            KeyInputHandler.addEventListener(this);
        } else {
            KeyInputHandler.removeEventListener(this);
        }
    }

    public onKeyEvent(event: KeyCodeControlMessage): void {
        this.sendMessage(event);
    }

    public sendNewVideoSetting(videoSettings: VideoSettings): void {
        this.requestedVideoSettings = videoSettings;
        this.sendMessage(CommandControlMessage.createSetVideoSettingsCommand(videoSettings));
    }

    public getClientId(): number {
        return this.clientId;
    }

    public getClientsCount(): number {
        return this.clientsCount;
    }

    public getMaxSize(): Size | undefined {
        if (!this.controlButtons) {
            return;
        }
        const body = document.body;
        const width = (body.clientWidth - this.controlButtons.clientWidth) & ~15;
        const height = body.clientHeight & ~15;
        return new Size(width, height);
    }

    private setTouchListeners(player: BasePlayer): void {
        if (this.touchHandler) {
            return;
        }
        this.touchHandler = new FeaturedTouchHandler(player, this);
    }

    private applyNewVideoSettings(videoSettings: VideoSettings, saveToStorage: boolean): void {
        let fitToScreen = false;
        if (videoSettings.bounds && videoSettings.bounds.equals(this.getMaxSize())) {
            fitToScreen = true;
        }
        if (this.player) {
            this.player.setVideoSettings(videoSettings, fitToScreen, saveToStorage);
        }
    }

    public static createEntryForDeviceList(
        descriptor: DroidDeviceDescriptor,
        blockClass: string,
    ): HTMLElement | DocumentFragment | undefined {
        const hasPid = descriptor.pid !== -1;
        if (hasPid) {
            const configureButtonId = `configure_${Util.escapeUdid(descriptor.udid)}`;
            const e = html`<div class="stream ${blockClass}">
                <button
                    ${ATTRIBUTE_UDID}="${descriptor.udid}"
                    ${ATTRIBUTE_COMMAND}="${DeviceTrackerCommand.CONFIGURE_STREAM}"
                    id="${configureButtonId}"
                    class="active action-button"
                >
                    Configure stream
                </button>
            </div>`;
            const a = e.content.getElementById(configureButtonId);
            a && (a.onclick = this.onConfigureStreamClick);
            return e.content;
        }
        return;
    }

    private static onConfigureStreamClick = (e: MouseEvent): void => {
        const button = e.currentTarget as HTMLAnchorElement;
        const udid = button.getAttribute(ATTRIBUTE_UDID);
        if (!udid) {
            return;
        }
        const tracker = DeviceTrackerDroid.getInstance();
        const descriptor = tracker.getDescriptorByUdid(udid);
        if (!descriptor) {
            return;
        }
        e.preventDefault();
        const elements = document.getElementsByName(
            `${DeviceTrackerDroid.AttributePrefixInterfaceSelectFor}${Util.escapeUdid(udid)}`,
        );
        if (!elements || !elements.length) {
            return;
        }
        const select = elements[0] as HTMLSelectElement;
        const optionElement = select.options[select.selectedIndex];
        const port = optionElement.getAttribute('data-port');
        const name = optionElement.getAttribute('data-name');
        const ipv4 = optionElement.getAttribute('value');
        const query = optionElement.getAttribute('data-query') || undefined;
        if (!port || !ipv4 || !name) {
            return;
        }
        const options: ConfigureScrcpyOptions = {
            port,
            name,
            ipv4,
            query,
        };
        const dialog = new ConfigureScrcpy(descriptor, options);
        dialog.on('closed', StreamClientScrcpy.onConfigureDialogClosed);
        StreamClientScrcpy.configureDialog = dialog;
    };

    private static onConfigureDialogClosed = (success: boolean): void => {
        StreamClientScrcpy.configureDialog?.off('closed', StreamClientScrcpy.onConfigureDialogClosed);
        StreamClientScrcpy.configureDialog = undefined;
        if (success) {
            const tracker = DeviceTrackerDroid.getInstance();
            tracker?.destroy();
            return;
        }
    };
}
