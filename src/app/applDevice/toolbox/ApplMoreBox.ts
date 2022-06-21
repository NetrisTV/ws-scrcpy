import '../../../style/morebox.css';
import { BasePlayer } from '../../player/BasePlayer';
import Size from '../../Size';
import { WdaProxyClient } from '../client/WdaProxyClient';

const TAG = '[ApplMoreBox]';

interface StopListener {
    onStop: () => void;
}

export class ApplMoreBox {
    private stopListener?: StopListener;
    private readonly holder: HTMLElement;

    constructor(udid: string, player: BasePlayer, wdaConnection: WdaProxyClient) {
        const playerName = player.getName();
        const moreBox = document.createElement('div');
        moreBox.className = 'more-box';
        const nameBox = document.createElement('p');
        nameBox.innerText = `${udid} (${playerName})`;
        nameBox.className = 'text-with-shadow';
        moreBox.appendChild(nameBox);
        const input = document.createElement('textarea');
        input.classList.add('text-area');
        const sendButton = document.createElement('button');
        sendButton.innerText = 'Send as keys';

        ApplMoreBox.wrap('p', [input, sendButton], moreBox);
        sendButton.onclick = () => {
            if (input.value) {
                wdaConnection.sendKeys(input.value);
            }
        };

        const qualityId = `show_video_quality_${udid}_${playerName}`;
        const qualityLabel = document.createElement('label');
        const qualityCheck = document.createElement('input');
        qualityCheck.type = 'checkbox';
        qualityCheck.checked = BasePlayer.DEFAULT_SHOW_QUALITY_STATS;
        qualityCheck.id = qualityId;
        qualityLabel.htmlFor = qualityId;
        qualityLabel.innerText = 'Show quality stats';
        ApplMoreBox.wrap('p', [qualityCheck, qualityLabel], moreBox);
        qualityCheck.onchange = () => {
            player.setShowQualityStats(qualityCheck.checked);
        };

        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(TAG, ev);
            }
            const parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            player.off('video-view-resize', this.onViewVideoResize);
            if (this.stopListener) {
                this.stopListener.onStop();
                delete this.stopListener;
            }
        };

        const stopBtn = document.createElement('button') as HTMLButtonElement;
        stopBtn.innerText = `Disconnect`;
        stopBtn.onclick = stop;

        ApplMoreBox.wrap('p', [stopBtn], moreBox);
        player.on('video-view-resize', this.onViewVideoResize);
        this.holder = moreBox;
    }

    private onViewVideoResize = (size: Size): void => {
        // padding: 10px
        this.holder.style.width = `${size.width - 2 * 10}px`;
    };

    protected static wrap(tagName: string, elements: HTMLElement[], parent: HTMLElement): HTMLElement {
        const wrap = document.createElement(tagName);
        elements.forEach((e) => {
            wrap.appendChild(e);
        });
        parent.appendChild(wrap);
        return wrap;
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public setOnStop(listener: StopListener): void {
        this.stopListener = listener;
    }
}
