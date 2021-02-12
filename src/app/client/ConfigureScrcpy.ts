import '../../style/dialog.css';
import DroidDeviceDescriptor from '../../common/DroidDeviceDescriptor';
import { StreamReceiver } from './StreamReceiver';
import VideoSettings from '../VideoSettings';
import ScreenInfo from '../ScreenInfo';
import { BaseClient } from './BaseClient';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import Size from '../Size';
import Util from '../Util';

export type ConfigureScrcpyOptions = {
    name: string;
    query?: string;
    port: string;
    ipv4: string;
};

interface ConfigureScrcpyEvents {
    closed: boolean;
}

export class ConfigureScrcpy extends BaseClient<ConfigureScrcpyEvents> {
    private readonly TAG: string;
    private readonly udid: string;
    private readonly escapedUdid: string;
    private readonly playerStorageKey: string;
    private deviceName: string;
    private ipv4: string;
    private query?: string;
    private port: string;
    private clientsCount?: number;
    private streamReceiver?: StreamReceiver;
    private playerName?: string;
    private background: HTMLElement;
    private dialogBody?: HTMLElement;
    private okButton?: HTMLButtonElement;
    private cancelButton?: HTMLButtonElement;
    private encoderSelectElement?: HTMLSelectElement;
    private connectionStatusElement?: HTMLElement;

    constructor(descriptor: DroidDeviceDescriptor, options: ConfigureScrcpyOptions) {
        super();
        this.udid = descriptor.udid;
        this.escapedUdid = Util.escapeUdid(this.udid);
        this.playerStorageKey = `configure_stream::${this.escapedUdid}::player`;
        this.deviceName = descriptor['ro.product.model'];
        this.ipv4 = options.ipv4;
        this.query = options.query;
        this.port = options.port;
        this.TAG = `ConfigureScrcpy[${this.udid}]`;
        this.createStreamReceiver();
        this.setTitle(`${this.deviceName}. Configure stream`);
        this.background = this.createUI();
    }

    private createStreamReceiver(): void {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.streamReceiver = new StreamReceiver(this.ipv4, this.port, this.query);
        this.attachEventsListeners(this.streamReceiver);
    }

    private attachEventsListeners(streamReceiver: StreamReceiver): void {
        streamReceiver.on('encoders', this.onEncoders);
        streamReceiver.on('clientsStats', this.onClientsStats);
        streamReceiver.on('videoParameters', this.onVideoParameters);
        streamReceiver.on('connected', this.onConnected);
        streamReceiver.on('disconnected', this.onDisconnected);
    }

    private detachEventsListeners(streamReceiver: StreamReceiver): void {
        streamReceiver.off('encoders', this.onEncoders);
        streamReceiver.off('clientsStats', this.onClientsStats);
        streamReceiver.off('videoParameters', this.onVideoParameters);
        streamReceiver.off('connected', this.onConnected);
        streamReceiver.off('disconnected', this.onDisconnected);
    }

    private onEncoders = (encoders: string[]): void => {
        console.log(this.TAG, 'Encoders', encoders);
        const select = this.encoderSelectElement || document.createElement('select');
        let child;
        while ((child = select.firstChild)) {
            select.removeChild(child);
        }
        encoders.unshift('');
        encoders.forEach((value) => {
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', value);
            optionElement.innerText = value;
            select.appendChild(optionElement);
        });
        this.encoderSelectElement = select;
    };

    private onClientsStats = (stats: { deviceName: string; clientId: number; clientsCount: number }): void => {
        this.clientsCount = stats.clientsCount;
        console.log(this.TAG, 'ClientStats', JSON.stringify(stats));
    };

    private onVideoParameters = (parameters: { videoSettings: VideoSettings; screenInfo: ScreenInfo }): void => {
        const { videoSettings, screenInfo } = parameters;
        console.log(this.TAG, 'VideoParameters', videoSettings.toString(), screenInfo.toString());
        if (this.clientsCount) {
            this.fillInputsFromVideoSettings(videoSettings);
        } else {
            const element = document.getElementById(`player_${this.escapedUdid}`);
            if (element) {
                const playerSelect = element as HTMLSelectElement;
                this.updateVideoSettingsForPlayer(playerSelect);
            }
        }
    };

    private onConnected = (): void => {
        console.log(this.TAG, 'Connected');
        if (this.connectionStatusElement) {
            this.connectionStatusElement.innerText = `(connected)`;
        }
        if (this.okButton) {
            this.okButton.disabled = false;
        }
        if (this.dialogBody) {
            this.dialogBody.classList.remove('hidden');
            this.dialogBody.classList.add('visible');
        }
    };

    private onDisconnected = (): void => {
        console.log(this.TAG, 'Disconnected');
        if (this.connectionStatusElement) {
            this.connectionStatusElement.innerText = `(disconnected)`;
        }
        if (this.okButton) {
            this.okButton.disabled = true;
        }
        if (this.dialogBody) {
            this.dialogBody.classList.remove('visible');
            this.dialogBody.classList.add('hidden');
        }
    };

    private onPlayerChange = (e: Event): void => {
        const playerSelect = e.currentTarget as HTMLSelectElement;
        this.updateVideoSettingsForPlayer(playerSelect);
    };

    private updateVideoSettingsForPlayer(playerSelect: HTMLSelectElement): void {
        const playerName = playerSelect.options[playerSelect.selectedIndex].value;
        const player = StreamClientScrcpy.getPlayers().find((playerClass) => {
            return playerClass.playerName === playerName;
        });
        if (player) {
            this.playerName = playerName;
            const preferred = player.getPreferredVideoSetting();
            const storedOrPreferred = player.getVideoSettingFromStorage(preferred, player.storageKeyPrefix, this.udid);
            this.fillInputsFromVideoSettings(storedOrPreferred);
        }
    }

    private getBasicInput(id: string): HTMLInputElement | null {
        const element = document.getElementById(`${id}_${this.escapedUdid}`);
        if (!element) {
            return null;
        }
        return element as HTMLInputElement;
    }

    private fillInputsFromVideoSettings(videoSettings: VideoSettings): void {
        this.fillBasicInput({ id: 'bitrate' }, videoSettings);
        this.fillBasicInput({ id: 'maxFps' }, videoSettings);
        this.fillBasicInput({ id: 'iFrameInterval' }, videoSettings);
        this.fillBasicInput({ id: 'displayId' }, videoSettings);
        this.fillBasicInput({ id: 'codecOptions' }, videoSettings);
        if (videoSettings.bounds) {
            const { width, height } = videoSettings.bounds;
            const widthInput = this.getBasicInput('maxWidth');
            if (widthInput) {
                widthInput.value = width.toString(10);
            }
            const heightInput = this.getBasicInput('maxHeight');
            if (heightInput) {
                heightInput.value = height.toString(10);
            }
        }
        if (videoSettings.encoderName) {
            console.log(this.TAG, 'Encoder:', videoSettings.encoderName);
        }
    }

    private fillBasicInput(opts: { id: keyof VideoSettings }, videoSettings: VideoSettings): void {
        const input = this.getBasicInput(opts.id);
        const value = videoSettings[opts.id];
        if (input && typeof value !== 'undefined' && value !== '-' && value !== 0 && value !== null) {
            input.value = value.toString(10);
        }
    }

    private appendBasicInput(parent: HTMLElement, opts: { label: string; id: string }): void {
        const label = document.createElement('label');
        label.classList.add('label');
        label.innerText = `${opts.label}:`;
        parent.appendChild(label);
        const input = document.createElement('input');
        input.classList.add('input');
        input.id = label.htmlFor = `${opts.id}_${this.escapedUdid}`;
        parent.appendChild(input);
    }

    private getNumberValueFromInput(name: string): number {
        const value = (document.getElementById(`${name}_${this.escapedUdid}`) as HTMLInputElement).value;
        return parseInt(value, 10);
    }

    private getStringValueFromInput(name: string): string {
        return (document.getElementById(`${name}_${this.escapedUdid}`) as HTMLInputElement).value;
    }

    private getValueFromSelect(name: string): string {
        const select = document.getElementById(`${name}_${this.escapedUdid}`) as HTMLSelectElement;
        return select.options[select.selectedIndex].value;
    }

    private buildVideoSettings(): VideoSettings | null {
        try {
            const bitrate = this.getNumberValueFromInput('bitrate');
            const maxFps = this.getNumberValueFromInput('maxFps');
            const iFrameInterval = this.getNumberValueFromInput('iFrameInterval');
            const maxWidth = this.getNumberValueFromInput('maxWidth');
            const maxHeight = this.getNumberValueFromInput('maxHeight');
            const displayId = this.getNumberValueFromInput('displayId');
            const codecOptions = this.getStringValueFromInput('codecOptions') || undefined;
            let bounds: Size | undefined;
            if (!isNaN(maxWidth) && !isNaN(maxHeight) && maxWidth && maxHeight) {
                bounds = new Size(maxWidth, maxHeight);
            }
            const encoderName = this.getValueFromSelect('encoderName') || undefined;
            return new VideoSettings({
                bitrate,
                bounds,
                maxFps,
                iFrameInterval,
                displayId,
                codecOptions,
                encoderName,
            });
        } catch (e) {
            console.error(e.message);
            return null;
        }
    }

    private getPreviouslyUsedPlayer(): string {
        if (!window.localStorage) {
            return '';
        }
        const result = window.localStorage.getItem(this.playerStorageKey);
        if (result) {
            return result;
        } else {
            return '';
        }
    }

    private setPreviouslyUsedPlayer(playerName: string): void {
        if (!window.localStorage) {
            return;
        }
        window.localStorage.setItem(this.playerStorageKey, playerName);
    }

    private createUI(): HTMLElement {
        const dialogName = 'configureDialog';
        const blockClass = 'dialog-block';
        const background = document.createElement('div');
        background.classList.add('dialog-background', dialogName);
        const dialogContainer = document.createElement('div');
        dialogContainer.classList.add('dialog-container', dialogName);
        const dialogHeader = document.createElement('div');
        dialogHeader.classList.add('dialog-header', blockClass, dialogName);
        const deviceName = document.createElement('span');
        deviceName.classList.add('dialog-title', 'main-title');
        deviceName.innerText = this.deviceName;
        const statusElement = document.createElement('span');
        statusElement.classList.add('dialog-title', 'subtitle');
        statusElement.innerText = `(connecting...)`;
        this.connectionStatusElement = statusElement;
        dialogHeader.appendChild(deviceName);
        dialogHeader.appendChild(statusElement);
        const dialogBody = (this.dialogBody = document.createElement('div'));
        dialogBody.classList.add('dialog-body', blockClass, dialogName, 'hidden');
        const playerWrapper = document.createElement('div');
        playerWrapper.classList.add('controls');
        const playerLabel = document.createElement('label');
        playerLabel.classList.add('label');
        playerLabel.innerText = 'Player:';
        playerWrapper.appendChild(playerLabel);
        const playerSelect = document.createElement('select');
        playerSelect.classList.add('input');
        playerSelect.id = playerLabel.htmlFor = `player_${this.escapedUdid}`;
        playerWrapper.appendChild(playerSelect);
        dialogBody.appendChild(playerWrapper);
        const previouslyUsedPlayer = this.getPreviouslyUsedPlayer();
        StreamClientScrcpy.getPlayers().forEach((playerClass, index) => {
            const { playerName } = playerClass;
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', playerName);
            optionElement.innerText = playerName;
            playerSelect.appendChild(optionElement);
            if (playerName === previouslyUsedPlayer) {
                playerSelect.selectedIndex = index;
            }
        });
        playerSelect.onchange = this.onPlayerChange;
        this.updateVideoSettingsForPlayer(playerSelect);

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.innerText = 'Video Settings';
        details.appendChild(summary);
        const controls = document.createElement('div');
        controls.classList.add('controls');

        this.appendBasicInput(controls, { label: 'Bitrate', id: 'bitrate' });
        this.appendBasicInput(controls, { label: 'Max FPS', id: 'maxFps' });
        this.appendBasicInput(controls, { label: 'I-Frame interval', id: 'iFrameInterval' });
        this.appendBasicInput(controls, { label: 'Max width', id: 'maxWidth' });
        this.appendBasicInput(controls, { label: 'Max height', id: 'maxHeight' });
        this.appendBasicInput(controls, { label: 'Display id', id: 'displayId' });
        this.appendBasicInput(controls, { label: 'Codec options', id: 'codecOptions' });

        const encoderLabel = document.createElement('label');
        encoderLabel.classList.add('label');
        encoderLabel.innerText = 'Encoder:';
        controls.appendChild(encoderLabel);
        if (this.encoderSelectElement) {
            controls.appendChild(this.encoderSelectElement);
        } else {
            const encoder = document.createElement('select');
            this.encoderSelectElement = encoder;
            controls.appendChild(encoder);
        }
        this.encoderSelectElement.classList.add('input');
        this.encoderSelectElement.id = encoderLabel.htmlFor = `encoderName_${this.escapedUdid}`;

        details.appendChild(controls);
        dialogBody.appendChild(details);
        const dialogFooter = document.createElement('div');
        dialogFooter.classList.add('dialog-footer', blockClass, dialogName);
        const cancelButton = (this.cancelButton = document.createElement('button'));
        cancelButton.innerText = 'Cancel';
        cancelButton.addEventListener('click', this.cancel);
        const okButton = (this.okButton = document.createElement('button'));
        okButton.innerText = 'Open';
        okButton.disabled = true;
        okButton.addEventListener('click', this.openStream);
        dialogFooter.appendChild(okButton);
        dialogFooter.appendChild(cancelButton);
        dialogBody.appendChild(dialogFooter);
        dialogContainer.appendChild(dialogHeader);
        dialogContainer.appendChild(dialogBody);
        dialogContainer.appendChild(dialogFooter);
        background.appendChild(dialogContainer);
        background.addEventListener('click', this.onBackgroundClick);
        document.body.appendChild(background);
        return background;
    }

    private removeUI(): void {
        document.body.removeChild(this.background);
        this.okButton?.removeEventListener('click', this.openStream);
        this.cancelButton?.removeEventListener('click', this.cancel);
        this.background.removeEventListener('click', this.onBackgroundClick);
    }

    private onBackgroundClick = (e: MouseEvent): void => {
        if (e.target !== e.currentTarget) {
            return;
        }
        this.cancel();
    };

    private cancel = (): void => {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.emit('closed', false);
        this.removeUI();
    };

    private openStream = (): void => {
        const params = {
            udid: this.udid,
        };
        const videoSettings = this.buildVideoSettings();
        if (!videoSettings || !this.streamReceiver || !this.playerName) {
            return;
        }
        console.log(this.TAG, 'openStream', params, videoSettings);
        this.emit('closed', true);
        this.removeUI();
        const player = StreamClientScrcpy.createPlayer(this.udid, this.playerName);
        if (!player) {
            return;
        }
        this.setPreviouslyUsedPlayer(this.playerName);
        // return;
        player.setVideoSettings(videoSettings, false);
        StreamClientScrcpy.createWithReceiver(this.streamReceiver, { playerName: player, udid: this.udid });
        this.streamReceiver.triggerInitialInfoEvents();
    };
}
