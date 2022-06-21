import { ApplMoreBox } from './ApplMoreBox';
import { BasePlayer } from '../../player/BasePlayer';
import { DefaultMjpegServerOption, MjpegServerOptions, WdaProxyClient } from '../client/WdaProxyClient';

export class ApplMjpegMoreBox extends ApplMoreBox {
    private readonly framerateInput: HTMLInputElement;
    private readonly scalingFactorInput: HTMLInputElement;
    private readonly qualityInput: HTMLInputElement;

    constructor(udid: string, player: BasePlayer, wdaConnection: WdaProxyClient) {
        super(udid, player, wdaConnection);

        const action = 'CHANGE_PARAMS';
        const text = 'Change stream parameters';
        const playerName = player.getName();
        const spoiler = document.createElement('div');
        const spoilerLabel = document.createElement('label');
        const spoilerCheck = document.createElement('input');

        const innerDiv = document.createElement('div');
        const id = `spoiler_video_${udid}_${playerName}_${action}`;
        const btn = document.createElement('button');

        spoiler.className = 'spoiler';
        spoilerCheck.type = 'checkbox';
        spoilerCheck.id = id;
        spoilerLabel.htmlFor = id;
        spoilerLabel.innerText = text;
        innerDiv.className = 'box';
        spoiler.appendChild(spoilerCheck);
        spoiler.appendChild(spoilerLabel);
        spoiler.appendChild(innerDiv);
        const defaultOptions = DefaultMjpegServerOption;

        const framerateLabel = document.createElement('label');
        framerateLabel.innerText = 'Framerate:';
        const framerateInput = document.createElement('input');
        framerateInput.placeholder = `1 .. 60`;
        framerateInput.value = `${defaultOptions.mjpegServerFramerate}`;
        ApplMjpegMoreBox.wrap('div', [framerateLabel, framerateInput], innerDiv);
        this.framerateInput = framerateInput;

        const scalingFactorLabel = document.createElement('label');
        scalingFactorLabel.innerText = 'Scaling factor:';
        const scalingFactorInput = document.createElement('input');
        scalingFactorInput.placeholder = `1 .. 100`;
        scalingFactorInput.value = `${defaultOptions.mjpegScalingFactor}`;
        const scalingWrapper = ApplMjpegMoreBox.wrap('div', [scalingFactorLabel, scalingFactorInput], innerDiv);
        // FIXME: scaling factor changes are not handled
        scalingWrapper.style.display = 'none';
        this.scalingFactorInput = scalingFactorInput;

        const qualityLabel = document.createElement('label');
        qualityLabel.innerText = 'Quality:';
        const qualityInput = document.createElement('input');
        qualityInput.placeholder = `1 .. 100`;
        qualityInput.value = `${defaultOptions.mjpegServerScreenshotQuality}`;
        ApplMjpegMoreBox.wrap('div', [qualityLabel, qualityInput], innerDiv);
        this.qualityInput = qualityInput;
        innerDiv.appendChild(btn);
        btn.innerText = text;
        btn.onclick = () => {
            const mjpegServerFramerate = parseInt(this.framerateInput.value, 10);
            const mjpegScalingFactor = parseInt(this.scalingFactorInput.value, 10);
            const mjpegServerScreenshotQuality = parseInt(this.qualityInput.value, 10);
            const options: MjpegServerOptions = {
                mjpegServerFramerate,
                mjpegScalingFactor,
                mjpegServerScreenshotQuality,
            };
            wdaConnection.setMjpegServerOptions(options);
        };
        const holder = this.getHolderElement();
        const childNodes = holder.childNodes;
        if (childNodes.length > 1) {
            holder.insertBefore(spoiler, childNodes[childNodes.length - 2]);
        } else {
            holder.appendChild(spoiler);
        }
    }
}
