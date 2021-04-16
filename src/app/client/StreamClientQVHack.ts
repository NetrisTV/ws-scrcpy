import { BaseClient } from './BaseClient';
import { QVHackStreamParams } from '../../common/QVHackStreamParams';
import { QVHackMoreBox } from '../toolbox/QVHackMoreBox';
import { QVHackToolBox } from '../toolbox/QVHackToolBox';
import WdaConnection from '../WdaConnection';
import { WsQVHackClient } from './WsQVHackClient';
import Size from '../Size';
import ScreenInfo from '../ScreenInfo';
import { StreamReceiver } from './StreamReceiver';
import Position from '../Position';
import { MsePlayerForQVHack } from '../player/MsePlayerForQVHack';
import { BasePlayer } from '../player/BasePlayer';
import { SimpleTouchHandler, TouchHandlerListener } from '../touchHandler/SimpleTouchHandler';

const ACTION = 'stream-qvh';
const PORT = 8080;
const WAIT_CLASS = 'wait';

const TAG = '[StreamClientQVHack]';

export class StreamClientQVHack extends BaseClient<never> implements TouchHandlerListener {
    public static ACTION: QVHackStreamParams['action'] = ACTION;
    private deviceName = '';
    private managerClient = new WsQVHackClient();
    private wdaConnection = new WdaConnection();
    private readonly udid: string;
    private wdaUrl?: string;
    private readonly streamReceiver: StreamReceiver;
    private videoWrapper?: HTMLElement;
    private touchHandler?: SimpleTouchHandler;

    constructor(params: QVHackStreamParams) {
        super();
        let udid = (this.udid = params.udid);

        // Workaround for qvh v0.5-beta
        if (udid.indexOf('-') !== -1) {
            udid = udid.replace('-', '');
            udid = encodeURIComponent(udid) + '%00'.repeat(16);
        } else {
            udid = encodeURIComponent(udid);
        }
        this.streamReceiver = new StreamReceiver(location.hostname, PORT, '/ws', `?stream=${udid}`);
        this.startStream(params.udid, `ws://${params.ip}:${params.port}/ws?stream=${udid}`);
        this.setBodyClass('stream');
        this.setTitle(`${params.udid} stream`);
    }

    private onViewVideoResize = (): void => {
        this.runWebDriverAgent();
    };
    private onInputVideoResize = (screenInfo: ScreenInfo): void => {
        this.wdaConnection.setScreenInfo(screenInfo);
    };

    private runWebDriverAgent() {
        if (typeof this.wdaUrl === 'string') {
            return;
        }

        this.wdaUrl = '';
        this.managerClient
            .runWebDriverAgent(this.udid)
            .then((response) => {
                const data = response.data;
                if (data.code === 0) {
                    const url = data.text;
                    this.wdaUrl = url;
                    this.wdaConnection.setUrl(url);
                } else {
                    console.error(TAG, `Failed to run WebDriverAgent. Reason: ${data.text}, code: ${data.code}`);
                }
            })
            .finally(() => {
                this.videoWrapper?.classList.remove(WAIT_CLASS);
            });
    }

    private startStream(udid: string, url: string) {
        const player = new MsePlayerForQVHack(udid, MsePlayerForQVHack.createElement(`qvh_video`));
        this.setTouchListeners(player);
        player.pause();

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
            this.managerClient.stop();
            player.stop();
        };

        const qvhackMoreBox = new QVHackMoreBox(udid, player);
        qvhackMoreBox.setOnStop(stop);
        const moreBox = qvhackMoreBox.getHolderElement();
        const qvhackToolBox = QVHackToolBox.createToolBox(udid, player, this, this.wdaConnection, moreBox);
        const controlButtons = qvhackToolBox.getHolderElement();
        deviceView.appendChild(controlButtons);
        const video = document.createElement('div');
        video.className = `video ${WAIT_CLASS}`;
        deviceView.appendChild(video);
        deviceView.appendChild(moreBox);
        player.setParent(video);
        player.on('video-view-resize', this.onViewVideoResize);
        player.on('input-video-resize', this.onInputVideoResize);
        this.videoWrapper = video;
        const bounds = StreamClientQVHack.getMaxSize(controlButtons);
        if (bounds) {
            player.setBounds(bounds);
        }

        document.body.appendChild(deviceView);
        this.streamReceiver.on('video', (data) => {
            const STATE = BasePlayer.STATE;
            if (player.getState() === STATE.PAUSED) {
                player.play();
            }
            if (player.getState() === STATE.PLAYING) {
                player.pushFrame(new Uint8Array(data));
            }
        });
        console.log(player.getName(), udid, url);
    }

    private static getMaxSize(controlButtons: HTMLElement): Size | undefined {
        if (!controlButtons) {
            return;
        }
        const body = document.body;
        const width = (body.clientWidth - controlButtons.clientWidth) & ~7;
        const height = body.clientHeight & ~7;
        return new Size(width, height);
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    private setTouchListeners(player: BasePlayer): void {
        if (this.touchHandler) {
            return;
        }
        this.touchHandler = new SimpleTouchHandler(player, this);
    }

    public performClick(position: Position): void {
        this.wdaConnection.wdaPerformClick(position);
    }

    public performScroll(from: Position, to: Position): void {
        this.wdaConnection.wdaPerformScroll(from, to);
    }
}
