import '../../../style/dialog.css';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DisplayCombinedInfo } from '../../client/StreamReceiver';
import VideoSettings from '../../VideoSettings';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import Size from '../../Size';
import Util from '../../Util';
import { DisplayInfo } from '../../DisplayInfo';
import { ToolBoxButton } from '../../toolbox/ToolBoxButton';
import SvgImage from '../../ui/SvgImage';
import { PlayerClass } from '../../player/BasePlayer';
import { ToolBoxCheckbox } from '../../toolbox/ToolBoxCheckbox';
import { DeviceTracker } from './DeviceTracker';
import { Attribute } from '../../Attribute';
import { StreamReceiverScrcpy } from './StreamReceiverScrcpy';
import { ParamsStreamScrcpy } from '../../../types/ParamsStreamScrcpy';
import { BaseClient } from '../../client/BaseClient';

interface ConfigureScrcpyEvents {
    closed: { dialog: ConfigureScrcpy; result: boolean };
}

type Range = {
    max: number;
    min: number;
    step: number;
    formatter?: (value: number) => string;
};

export class ConfigureScrcpy extends BaseClient<ParamsStreamScrcpy, ConfigureScrcpyEvents> {
    private readonly TAG: string;
    private readonly udid: string;
    private readonly escapedUdid: string;
    private readonly playerStorageKey: string;
    private deviceName: string;
    private streamReceiver?: StreamReceiverScrcpy;
    private playerName?: string;
    private displayInfo?: DisplayInfo;
    private background: HTMLElement;
    private dialogBody?: HTMLElement;
    private okButton?: HTMLButtonElement;
    private fitToScreenCheckbox?: HTMLInputElement;
    private resetSettingsButton?: HTMLButtonElement;
    private loadSettingsButton?: HTMLButtonElement;
    private saveSettingsButton?: HTMLButtonElement;
    private playerSelectElement?: HTMLSelectElement;
    private displayIdSelectElement?: HTMLSelectElement;
    private encoderSelectElement?: HTMLSelectElement;
    private connectionStatusElement?: HTMLElement;
    private dialogContainer?: HTMLElement;
    private statusText = '';
    private connectionCount = 0;

    constructor(private readonly tracker: DeviceTracker, descriptor: GoogDeviceDescriptor, params: ParamsStreamScrcpy) {
        super(params);
        this.udid = descriptor.udid;
        this.escapedUdid = Util.escapeUdid(this.udid);
        this.playerStorageKey = `configure_stream::${this.escapedUdid}::player`;
        this.deviceName = descriptor['ro.product.model'];
        this.TAG = `ConfigureScrcpy[${this.udid}]`;
        this.createStreamReceiver(params);
        this.setTitle(`${this.deviceName}. Configure stream`);
        this.background = this.createUI();
    }

    public getTracker(): DeviceTracker {
        return this.tracker;
    }

    private createStreamReceiver(params: ParamsStreamScrcpy): void {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.streamReceiver = new StreamReceiverScrcpy(params);
        this.attachEventsListeners(this.streamReceiver);
    }

    private attachEventsListeners(streamReceiver: StreamReceiverScrcpy): void {
        streamReceiver.on('encoders', this.onEncoders);
        streamReceiver.on('displayInfo', this.onDisplayInfo);
        streamReceiver.on('connected', this.onConnected);
        streamReceiver.on('disconnected', this.onDisconnected);
    }

    private detachEventsListeners(streamReceiver: StreamReceiverScrcpy): void {
        streamReceiver.off('encoders', this.onEncoders);
        streamReceiver.off('displayInfo', this.onDisplayInfo);
        streamReceiver.off('connected', this.onConnected);
        streamReceiver.off('disconnected', this.onDisconnected);
    }

    private updateStatus(): void {
        if (!this.connectionStatusElement) {
            return;
        }
        let text = this.statusText;
        if (this.connectionCount) {
            text = `${text}. Other clients: ${this.connectionCount}.`;
        }
        this.connectionStatusElement.innerText = text;
    }

    private onEncoders = (encoders: string[]): void => {
        // console.log(this.TAG, 'Encoders', encoders);
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

    private onDisplayInfo = (infoArray: DisplayCombinedInfo[]): void => {
        // console.log(this.TAG, 'Received info');
        this.statusText = 'Ready';
        this.updateStatus();
        this.dialogContainer?.classList.add('ready');
        const select = this.displayIdSelectElement || document.createElement('select');
        let child;
        while ((child = select.firstChild)) {
            select.removeChild(child);
        }
        let selectedOptionIdx = -1;
        infoArray.forEach((value: DisplayCombinedInfo, idx: number) => {
            const { displayInfo } = value;
            const { displayId, size } = displayInfo;
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', displayId.toString());
            optionElement.innerText = `ID: ${displayId}; ${size.width}x${size.height}`;
            select.appendChild(optionElement);
            if (
                (this.displayInfo && this.displayInfo.displayId === displayId) ||
                (!this.displayInfo && displayId === DisplayInfo.DEFAULT_DISPLAY)
            ) {
                selectedOptionIdx = idx;
            }
        });
        if (selectedOptionIdx > -1) {
            select.selectedIndex = selectedOptionIdx;
            const { videoSettings, connectionCount, displayInfo } = infoArray[selectedOptionIdx];
            this.displayInfo = displayInfo;
            if (connectionCount > 0 && videoSettings) {
                // console.log(this.TAG, 'Apply other clients settings');
                this.fillInputsFromVideoSettings(videoSettings, false);
            } else {
                // console.log(this.TAG, 'Apply settings for current player');
                this.updateVideoSettingsForPlayer();
            }
            this.connectionCount = connectionCount;
            this.updateStatus();
        }
        this.displayIdSelectElement = select;
        if (this.dialogBody) {
            this.dialogBody.classList.remove('hidden');
            this.dialogBody.classList.add('visible');
        }
    };

    private onConnected = (): void => {
        // console.log(this.TAG, 'Connected');
        this.statusText = 'Waiting for info...';
        this.updateStatus();
        if (this.okButton) {
            this.okButton.disabled = false;
        }
    };

    private onDisconnected = (): void => {
        // console.log(this.TAG, 'Disconnected');
        this.statusText = 'Disconnected';
        this.updateStatus();
        if (this.okButton) {
            this.okButton.disabled = true;
        }
        if (this.dialogBody) {
            this.dialogBody.classList.remove('visible');
            this.dialogBody.classList.add('hidden');
        }
    };

    private onPlayerChange = (): void => {
        this.updateVideoSettingsForPlayer();
    };

    private onDisplayIdChange = (): void => {
        const select = this.displayIdSelectElement;
        if (!select || !this.streamReceiver) {
            return;
        }
        const value = select.options[select.selectedIndex].value;
        const displayId = parseInt(value, 10);
        if (!isNaN(displayId)) {
            this.displayInfo = this.streamReceiver.getDisplayInfo(displayId);
        }
        this.updateVideoSettingsForPlayer();
    };

    private getPlayer(): PlayerClass | undefined {
        if (!this.playerSelectElement) {
            return;
        }
        const playerName = this.playerSelectElement.options[this.playerSelectElement.selectedIndex].value;
        return StreamClientScrcpy.getPlayers().find((playerClass) => {
            return playerClass.playerFullName === playerName;
        });
    }

    private updateVideoSettingsForPlayer(): void {
        const player = this.getPlayer();
        if (player) {
            this.playerName = player.playerFullName;
            const storedOrPreferred = player.loadVideoSettings(this.udid, this.displayInfo);
            const fitToScreen = player.getFitToScreenStatus(this.udid, this.displayInfo);
            this.fillInputsFromVideoSettings(storedOrPreferred, fitToScreen);
        }
    }

    private getBasicInput(id: string): HTMLInputElement | null {
        const element = document.getElementById(`${id}_${this.escapedUdid}`);
        if (!element) {
            return null;
        }
        return element as HTMLInputElement;
    }

    private fillInputsFromVideoSettings(videoSettings: VideoSettings, fitToScreen: boolean): void {
        if (this.displayInfo && this.displayInfo.displayId !== videoSettings.displayId) {
            console.error(this.TAG, `Display id from VideoSettings and DisplayInfo don't match`);
        }
        this.fillBasicInput({ id: 'bitrate' }, videoSettings);
        this.fillBasicInput({ id: 'maxFps' }, videoSettings);
        this.fillBasicInput({ id: 'iFrameInterval' }, videoSettings);
        // this.fillBasicInput({ id: 'displayId' }, videoSettings);
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
        if (this.encoderSelectElement) {
            const encoderName = videoSettings.encoderName || '';
            const option = Array.from(this.encoderSelectElement.options).find((element) => {
                return element.value === encoderName;
            });
            if (option) {
                this.encoderSelectElement.selectedIndex = option.index;
            }
        }
        if (this.fitToScreenCheckbox) {
            this.fitToScreenCheckbox.checked = fitToScreen;
            this.onFitToScreenChanged(fitToScreen);
        }
    }

    private onFitToScreenChanged(checked: boolean) {
        const heightInput = this.getBasicInput('maxHeight');
        const widthInput = this.getBasicInput('maxWidth');
        if (!this.fitToScreenCheckbox || !heightInput || !widthInput) {
            return;
        }
        heightInput.disabled = widthInput.disabled = checked;
        if (checked) {
            heightInput.setAttribute(Attribute.VALUE, heightInput.value);
            heightInput.value = '';
            widthInput.setAttribute(Attribute.VALUE, widthInput.value);
            widthInput.value = '';
        } else {
            const storedHeight = heightInput.getAttribute(Attribute.VALUE);
            if (typeof storedHeight === 'string') {
                heightInput.value = storedHeight;
                heightInput.removeAttribute(Attribute.VALUE);
            }
            const storedWidth = widthInput.getAttribute(Attribute.VALUE);
            if (typeof storedWidth === 'string') {
                widthInput.value = storedWidth;
                widthInput.removeAttribute(Attribute.VALUE);
            }
        }
    }

    private fillBasicInput(opts: { id: keyof VideoSettings }, videoSettings: VideoSettings): void {
        const input = this.getBasicInput(opts.id);
        const value = videoSettings[opts.id];
        if (input) {
            if (typeof value !== 'undefined' && value !== '-' && value !== 0 && value !== null) {
                input.value = value.toString(10);
                if (input.getAttribute('type') === 'range') {
                    input.dispatchEvent(new Event('input'));
                }
            } else {
                input.value = '';
            }
        }
    }

    private appendBasicInput(
        parent: HTMLElement,
        opts: { label: string; id: string; range?: Range },
    ): HTMLInputElement {
        const label = document.createElement('label');
        label.classList.add('label');
        label.innerText = `${opts.label}:`;
        label.id = `label_${opts.id}_${this.escapedUdid}`;
        parent.appendChild(label);
        const input = document.createElement('input');
        input.classList.add('input');
        input.id = label.htmlFor = `${opts.id}_${this.escapedUdid}`;
        const { range } = opts;
        if (range) {
            label.setAttribute('title', opts.label);
            input.oninput = () => {
                const value = range.formatter ? range.formatter(parseInt(input.value, 10)) : input.value;
                label.innerText = `${opts.label} (${value}):`;
            };
            input.setAttribute('type', 'range');
            input.setAttribute('max', range.max.toString());
            input.setAttribute('min', range.min.toString());
            input.setAttribute('step', range.step.toString());
        }
        parent.appendChild(input);
        return input;
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
        } catch (error: any) {
            console.error(this.TAG, error.message);
            return null;
        }
    }

    private getFitToScreenValue(): boolean {
        if (!this.fitToScreenCheckbox) {
            return false;
        }
        return this.fitToScreenCheckbox.checked;
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
        const dialogContainer = (this.dialogContainer = document.createElement('div'));
        dialogContainer.classList.add('dialog-container', dialogName);
        const dialogHeader = document.createElement('div');
        dialogHeader.classList.add('dialog-header', dialogName, 'control-wrapper');
        const backButton = new ToolBoxButton('Back', SvgImage.Icon.ARROW_BACK);

        backButton.addEventListener('click', () => {
            this.cancel();
        });
        backButton.getAllElements().forEach((el) => {
            dialogHeader.appendChild(el);
        });

        const deviceName = document.createElement('span');
        deviceName.classList.add('dialog-title', 'main-title');
        deviceName.innerText = this.deviceName;
        dialogHeader.appendChild(deviceName);
        const dialogBody = (this.dialogBody = document.createElement('div'));
        dialogBody.classList.add('dialog-body', blockClass, dialogName, 'hidden');
        const playerWrapper = document.createElement('div');
        playerWrapper.classList.add('controls');
        const playerLabel = document.createElement('label');
        playerLabel.classList.add('label');
        playerLabel.innerText = 'Player:';
        playerWrapper.appendChild(playerLabel);
        const playerSelect = (this.playerSelectElement = document.createElement('select'));
        playerSelect.classList.add('input');
        playerSelect.id = playerLabel.htmlFor = `player_${this.escapedUdid}`;
        playerWrapper.appendChild(playerSelect);
        dialogBody.appendChild(playerWrapper);
        const previouslyUsedPlayer = this.getPreviouslyUsedPlayer();
        StreamClientScrcpy.getPlayers().forEach((playerClass, index) => {
            const { playerFullName } = playerClass;
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', playerFullName);
            optionElement.innerText = playerFullName;
            playerSelect.appendChild(optionElement);
            if (playerFullName === previouslyUsedPlayer) {
                playerSelect.selectedIndex = index;
            }
        });
        playerSelect.onchange = this.onPlayerChange;
        this.updateVideoSettingsForPlayer();

        const controls = document.createElement('div');
        controls.classList.add('controls', 'control-wrapper');
        const displayIdLabel = document.createElement('label');
        displayIdLabel.classList.add('label');
        displayIdLabel.innerText = 'Display:';
        controls.appendChild(displayIdLabel);
        if (!this.displayIdSelectElement) {
            this.displayIdSelectElement = document.createElement('select');
        }
        controls.appendChild(this.displayIdSelectElement);
        this.displayIdSelectElement.classList.add('input');
        this.displayIdSelectElement.id = displayIdLabel.htmlFor = `displayId_${this.escapedUdid}`;
        this.displayIdSelectElement.onchange = this.onDisplayIdChange;

        this.appendBasicInput(controls, {
            label: 'Bitrate',
            id: 'bitrate',
            range: { min: 524288, max: 8388608, step: 524288, formatter: Util.prettyBytes },
        });
        this.appendBasicInput(controls, {
            label: 'Max FPS',
            id: 'maxFps',
            range: { min: 1, max: 60, step: 1 },
        });
        this.appendBasicInput(controls, { label: 'I-Frame interval', id: 'iFrameInterval' });
        const fitLabel = document.createElement('label');
        fitLabel.innerText = 'Fit to screen';
        fitLabel.classList.add('label');
        controls.appendChild(fitLabel);
        const fitToggle = new ToolBoxCheckbox(
            'Fit to screen',
            { off: SvgImage.Icon.TOGGLE_OFF, on: SvgImage.Icon.TOGGLE_ON },
            'fit_to_screen',
        );
        fitToggle.getAllElements().forEach((el) => {
            controls.appendChild(el);
            if (el instanceof HTMLLabelElement) {
                fitLabel.htmlFor = el.htmlFor;
                el.classList.add('input');
            }
            if (el instanceof HTMLInputElement) {
                this.fitToScreenCheckbox = el;
            }
        });
        fitToggle.addEventListener('click', (_, el) => {
            const element = el.getElement();
            this.onFitToScreenChanged(element.checked);
        });
        this.appendBasicInput(controls, { label: 'Max width', id: 'maxWidth' });
        this.appendBasicInput(controls, { label: 'Max height', id: 'maxHeight' });
        this.appendBasicInput(controls, { label: 'Codec options', id: 'codecOptions' });

        const encoderLabel = document.createElement('label');
        encoderLabel.classList.add('label');
        encoderLabel.innerText = 'Encoder:';
        controls.appendChild(encoderLabel);
        if (!this.encoderSelectElement) {
            this.encoderSelectElement = document.createElement('select');
        }
        controls.appendChild(this.encoderSelectElement);
        this.encoderSelectElement.classList.add('input');
        this.encoderSelectElement.id = encoderLabel.htmlFor = `encoderName_${this.escapedUdid}`;

        dialogBody.appendChild(controls);

        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.classList.add('controls');

        const resetSettingsButton = (this.resetSettingsButton = document.createElement('button'));
        resetSettingsButton.classList.add('button');
        resetSettingsButton.innerText = 'Reset settings';
        resetSettingsButton.addEventListener('click', this.resetSettings);
        buttonsWrapper.appendChild(resetSettingsButton);

        const loadSettingsButton = (this.loadSettingsButton = document.createElement('button'));
        loadSettingsButton.classList.add('button');
        loadSettingsButton.innerText = 'Load settings';
        loadSettingsButton.addEventListener('click', this.loadSettings);
        buttonsWrapper.appendChild(loadSettingsButton);

        const saveSettingsButton = (this.saveSettingsButton = document.createElement('button'));
        saveSettingsButton.classList.add('button');
        saveSettingsButton.innerText = 'Save settings';
        saveSettingsButton.addEventListener('click', this.saveSettings);
        buttonsWrapper.appendChild(saveSettingsButton);

        dialogBody.appendChild(buttonsWrapper);

        const dialogFooter = document.createElement('div');
        dialogFooter.classList.add('dialog-footer', blockClass, dialogName);
        const statusElement = document.createElement('span');
        statusElement.classList.add('subtitle');
        this.connectionStatusElement = statusElement;
        dialogFooter.appendChild(statusElement);
        this.statusText = `Connecting...`;
        this.updateStatus();

        // const cancelButton = (this.cancelButton = document.createElement('button'));
        // cancelButton.innerText = 'Cancel';
        // cancelButton.addEventListener('click', this.cancel);
        const okButton = (this.okButton = document.createElement('button'));
        okButton.innerText = 'Open';
        okButton.disabled = true;
        okButton.addEventListener('click', this.openStream);
        dialogFooter.appendChild(okButton);
        // dialogFooter.appendChild(cancelButton);
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
        // this.cancelButton?.removeEventListener('click', this.cancel);
        this.resetSettingsButton?.removeEventListener('click', this.resetSettings);
        this.loadSettingsButton?.removeEventListener('click', this.loadSettings);
        this.saveSettingsButton?.removeEventListener('click', this.saveSettings);
        this.background.removeEventListener('click', this.onBackgroundClick);
    }

    private onBackgroundClick = (event: MouseEvent): void => {
        if (event.target !== event.currentTarget) {
            return;
        }
        this.cancel();
    };

    private cancel = (): void => {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.emit('closed', { dialog: this, result: false });
        this.removeUI();
    };

    private resetSettings = (): void => {
        const player = this.getPlayer();
        if (player) {
            this.fillInputsFromVideoSettings(player.getPreferredVideoSetting(), false);
        }
    };

    private loadSettings = (): void => {
        this.updateVideoSettingsForPlayer();
    };

    private saveSettings = (): void => {
        const videoSettings = this.buildVideoSettings();
        const player = this.getPlayer();
        if (videoSettings && player) {
            const fitToScreen = this.getFitToScreenValue();
            player.saveVideoSettings(this.udid, videoSettings, fitToScreen, this.displayInfo);
        }
    };

    private openStream = (): void => {
        const videoSettings = this.buildVideoSettings();
        if (!videoSettings || !this.streamReceiver || !this.playerName) {
            return;
        }
        const fitToScreen = this.getFitToScreenValue();
        this.detachEventsListeners(this.streamReceiver);
        this.emit('closed', { dialog: this, result: true });
        this.removeUI();
        const player = StreamClientScrcpy.createPlayer(this.playerName, this.udid, this.displayInfo);
        if (!player) {
            return;
        }
        this.setPreviouslyUsedPlayer(this.playerName);
        // return;
        player.setVideoSettings(videoSettings, fitToScreen, false);
        const params: ParamsStreamScrcpy = {
            ...this.params,
            udid: this.udid,
            fitToScreen,
        };
        StreamClientScrcpy.start(params, this.streamReceiver, player, fitToScreen, videoSettings);
        this.streamReceiver.triggerInitialInfoEvents();
    };
}
