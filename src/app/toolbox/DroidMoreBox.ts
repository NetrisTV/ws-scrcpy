import Decoder, { VideoResizeListener } from '../decoder/Decoder';
import { TextControlMessage } from '../controlMessage/TextControlMessage';
import { CommandControlMessage } from '../controlMessage/CommandControlMessage';
import { ControlMessage } from '../controlMessage/ControlMessage';
import Size from '../Size';
import DeviceMessage from '../DeviceMessage';
import VideoSettings from '../VideoSettings';
import { ScrcpyClient } from '../client/ScrcpyClient';

export class DroidMoreBox implements VideoResizeListener {
    private onStop?: () => void;
    private readonly holder: HTMLElement;
    private readonly input: HTMLInputElement;

    constructor(udid: string, decoder: Decoder, client: ScrcpyClient) {
        const decoderName = decoder.getName();
        const videoSettings = decoder.getVideoSettings();
        const moreBox = document.createElement('div');
        moreBox.className = 'more-box';
        const nameBox = document.createElement('p');
        nameBox.innerText = `${udid} (${decoderName})`;
        nameBox.className = 'text-with-shadow';
        moreBox.appendChild(nameBox);
        const input = (this.input = document.createElement('input'));
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send as keys';

        DroidMoreBox.wrap('p', [input, sendButton], moreBox);
        sendButton.onclick = () => {
            if (input.value) {
                client.sendEvent(new TextControlMessage(input.value));
            }
        };

        const controlButtons = document.createElement('div');
        controlButtons.className = 'control-buttons-list';
        const commands: HTMLElement[] = [];
        const codes = CommandControlMessage.CommandCodes;
        for (const command in codes) {
            if (codes.hasOwnProperty(command)) {
                const action: number = codes[command];
                const btn = document.createElement('button');
                let bitrateInput: HTMLInputElement;
                let maxFpsInput: HTMLInputElement;
                let iFrameIntervalInput: HTMLInputElement;
                let maxWidthInput: HTMLInputElement;
                let maxHeightInput: HTMLInputElement;
                if (action === ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS) {
                    const spoiler = document.createElement('div');
                    const spoilerLabel = document.createElement('label');
                    const spoilerCheck = document.createElement('input');

                    const innerDiv = document.createElement('div');
                    const id = `spoiler_video_${udid}_${decoderName}_${action}`;

                    spoiler.className = 'spoiler';
                    spoilerCheck.type = 'checkbox';
                    spoilerCheck.id = id;
                    spoilerLabel.htmlFor = id;
                    spoilerLabel.innerText = CommandControlMessage.CommandNames[action];
                    innerDiv.className = 'box';
                    spoiler.appendChild(spoilerCheck);
                    spoiler.appendChild(spoilerLabel);
                    spoiler.appendChild(innerDiv);

                    const bitrateLabel = document.createElement('label');
                    bitrateLabel.innerText = 'Bitrate:';
                    bitrateInput = document.createElement('input');
                    bitrateInput.placeholder = `bitrate (${videoSettings.bitrate})`;
                    bitrateInput.value = videoSettings.bitrate.toString();
                    DroidMoreBox.wrap('div', [bitrateLabel, bitrateInput], innerDiv);

                    const maxFpsLabel = document.createElement('label');
                    maxFpsLabel.innerText = 'Max fps:';
                    maxFpsInput = document.createElement('input');
                    maxFpsInput.placeholder = `max fps (${videoSettings.maxFps})`;
                    maxFpsInput.value = videoSettings.maxFps.toString();
                    DroidMoreBox.wrap('div', [maxFpsLabel, maxFpsInput], innerDiv);

                    const iFrameIntervalLabel = document.createElement('label');
                    iFrameIntervalLabel.innerText = 'I-Frame Interval:';
                    iFrameIntervalInput = document.createElement('input');
                    iFrameIntervalInput.placeholder = `I-frame interval (${videoSettings.iFrameInterval})`;
                    iFrameIntervalInput.value = videoSettings.iFrameInterval.toString();
                    DroidMoreBox.wrap('div', [iFrameIntervalLabel, iFrameIntervalInput], innerDiv);

                    const { width, height } = videoSettings.bounds || DroidMoreBox.getMaxSize(controlButtons);

                    const maxWidthLabel = document.createElement('label');
                    maxWidthLabel.innerText = 'Max width:';
                    maxWidthInput = document.createElement('input');
                    maxWidthInput.placeholder = `max width (${width})`;
                    maxWidthInput.value = width.toString();
                    DroidMoreBox.wrap('div', [maxWidthLabel, maxWidthInput], innerDiv);

                    const maxHeightLabel = document.createElement('label');
                    maxHeightLabel.innerText = 'Max height:';
                    maxHeightInput = document.createElement('input');
                    maxHeightInput.placeholder = `max height (${height})`;
                    maxHeightInput.value = height.toString();
                    DroidMoreBox.wrap('div', [maxHeightLabel, maxHeightInput], innerDiv);

                    innerDiv.appendChild(btn);
                    commands.push(spoiler);
                } else {
                    commands.push(btn);
                }
                btn.innerText = CommandControlMessage.CommandNames[action];
                btn.onclick = () => {
                    let event: CommandControlMessage | undefined;
                    if (action === ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS) {
                        const bitrate = parseInt(bitrateInput.value, 10);
                        const maxFps = parseInt(maxFpsInput.value, 10);
                        const iFrameInterval = parseInt(iFrameIntervalInput.value, 10);
                        if (isNaN(bitrate) || isNaN(maxFps)) {
                            return;
                        }
                        const width = parseInt(maxWidthInput.value, 10) & ~15;
                        const height = parseInt(maxHeightInput.value, 10) & ~15;
                        const bounds = new Size(width, height);
                        const videoSettings = new VideoSettings({
                            bounds,
                            bitrate,
                            maxFps,
                            iFrameInterval,
                            lockedVideoOrientation: -1,
                            sendFrameMeta: false,
                        });
                        client.sendNewVideoSetting(videoSettings);
                    } else if (action === CommandControlMessage.TYPE_SET_CLIPBOARD) {
                        const text = input.value;
                        if (text) {
                            event = CommandControlMessage.createSetClipboardCommand(text);
                        }
                    } else {
                        event = new CommandControlMessage(action);
                    }
                    if (event) {
                        client.sendEvent(event);
                    }
                };
            }
        }
        DroidMoreBox.wrap('p', commands, moreBox);

        const qualityId = `show_video_quality_${udid}_${decoderName}`;
        const qualityLabel = document.createElement('label');
        const qualityCheck = document.createElement('input');
        qualityCheck.type = 'checkbox';
        qualityCheck.checked = Decoder.DEFAULT_SHOW_QUALITY_STATS;
        qualityCheck.id = qualityId;
        qualityLabel.htmlFor = qualityId;
        qualityLabel.innerText = 'Show quality stats';
        DroidMoreBox.wrap('p', [qualityCheck, qualityLabel], moreBox);
        qualityCheck.onchange = () => {
            decoder.setShowQualityStats(qualityCheck.checked);
        };

        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(ev);
            }
            const parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            decoder.removeResizeListener(this);
            if (this.onStop) {
                this.onStop();
                delete this.onStop;
            }
        };

        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Disconnect`;
        stopBtn.onclick = stop;

        DroidMoreBox.wrap('p', [stopBtn], moreBox);
        decoder.addResizeListener(this);
        this.holder = moreBox;
    }

    public onViewVideoResize(size: Size): void {
        // padding: 10px
        this.holder.style.width = `${size.width - 2 * 10}px`;
    }
    public onInputVideoResize(/*screenInfo: ScreenInfo*/): void {
        // this.connection.setScreenInfo(screenInfo);
    }

    public OnDeviceMessage(ev: DeviceMessage): void {
        if (ev.type !== DeviceMessage.TYPE_CLIPBOARD) {
            return;
        }
        this.input.value = ev.getText();
        this.input.select();
        document.execCommand('copy');
    }

    private static wrap(tagName: string, elements: HTMLElement[], parent: HTMLElement): void {
        const wrap = document.createElement(tagName);
        elements.forEach((e) => {
            wrap.appendChild(e);
        });
        parent.appendChild(wrap);
    }

    private static getMaxSize(controlButtons: HTMLElement): Size {
        const body = document.body;
        const width = (body.clientWidth - controlButtons.clientWidth) & ~15;
        const height = body.clientHeight & ~15;
        return new Size(width, height);
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public setOnStop(listener: () => void) {
        this.onStop = listener;
    }
}
