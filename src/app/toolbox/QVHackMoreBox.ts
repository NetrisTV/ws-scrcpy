import Decoder, { VideoResizeListener } from '../decoder/Decoder';
import Size from '../Size';

export class QVHackMoreBox implements VideoResizeListener {
    private onStop?: () => void;
    private readonly holder: HTMLElement;

    constructor(udid: string, decoder: Decoder) {
        const decoderName = decoder.getName();
        const moreBox = document.createElement('div');
        moreBox.className = 'more-box';
        const nameBox = document.createElement('p');
        nameBox.innerText = `${udid} (${decoderName})`;
        nameBox.className = 'text-with-shadow';
        moreBox.appendChild(nameBox);

        const qualityId = `show_video_quality_${udid}_${decoderName}`;
        const qualityLabel = document.createElement('label');
        const qualityCheck = document.createElement('input');
        qualityCheck.type = 'checkbox';
        qualityCheck.checked = Decoder.DEFAULT_SHOW_QUALITY_STATS;
        qualityCheck.id = qualityId;
        qualityLabel.htmlFor = qualityId;
        qualityLabel.innerText = 'Show quality stats';
        QVHackMoreBox.wrap('p', [qualityCheck, qualityLabel], moreBox);
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

        QVHackMoreBox.wrap('p', [stopBtn], moreBox);
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

    private static wrap(tagName: string, elements: HTMLElement[], parent: HTMLElement): void {
        const wrap = document.createElement(tagName);
        elements.forEach((e) => {
            wrap.appendChild(e);
        });
        parent.appendChild(wrap);
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public setOnStop(listener: () => void): void {
        this.onStop = listener;
    }
}
