import { BaseClient } from './BaseClient';
import { QVHackStreamParams } from '../../common/QVHackStreamParams';
import { QVHackMoreBox } from '../toolbox/QVHackMoreBox';
import { QVHackToolBox } from '../toolbox/QVHackToolBox';
import WdaConnection from '../WdaConnection';
import { WsQVHackClient } from './WsQVHackClient';
import Size from '../Size';
import ScreenInfo from '../ScreenInfo';
import { StreamReceiver } from './StreamReceiver';
import { TouchHandler, TouchHandlerListener } from '../TouchHandler';
// import Position from '../Position';
import { MsePlayerForQVHack } from '../player/MsePlayerForQVHack';
import { BasePlayer } from '../player/BasePlayer';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';

const ACTION = 'stream-qvh';
const PORT = 8080;
const WAIT_CLASS = 'wait';

export class StreamClientQVHack extends BaseClient<never> implements TouchHandlerListener {
    public static ACTION: QVHackStreamParams['action'] = ACTION;
    private deviceName = '';
    private managerClient = new WsQVHackClient();
    private wdaConnection = new WdaConnection();
    private readonly udid: string;
    private wdaUrl?: string;
    private readonly streamReceiver: StreamReceiver;
    private videoWrapper?: HTMLElement;
    private touchHandler?: TouchHandler;

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

    public sendMessage(message: TouchControlMessage): void {
        console.log(message);
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
                    console.error(`Failed to run WebDriverAgent. Reason: ${data.text}, code: ${data.code}`);
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
                console.error(ev);
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
        const width = (body.clientWidth - controlButtons.clientWidth) & ~15;
        const height = body.clientHeight & ~15;
        return new Size(width, height);
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    private setTouchListeners(player: BasePlayer): void {
        if (this.touchHandler) {
            return;
        }
        this.touchHandler = TouchHandler.createTouchHandler(player, this);
        // if (!this.hasTouchListeners) {
        //     TouchHandler.init();
        //     let down = 0;
        //     // const supportsPassive = Util.supportsPassive();
        //     let startPosition: Position | undefined;
        //     let endPosition: Position | undefined;
        //     const onMouseEvent = (e: MouseEvent) => {
        //         let handled = false;
        //         const tag = player.getTouchableElement();
        //
        //         if (e.target === tag) {
        //             const screenInfo: ScreenInfo = player.getScreenInfo() as ScreenInfo;
        //             if (!screenInfo) {
        //                 return;
        //             }
        //             handled = true;
        //             const events = TouchHandler.buildTouchEvent(e, screenInfo);
        //             if (down === 1 && events?.length === 1) {
        //                 if (e.type === 'mousedown') {
        //                     startPosition = events[0].position;
        //                 } else {
        //                     endPosition = events[0].position;
        //                 }
        //                 const target = e.target as HTMLCanvasElement;
        //                 const ctx = target.getContext('2d');
        //                 if (ctx) {
        //                     if (startPosition) {
        //                         TouchHandler.drawPointer(ctx, startPosition.point);
        //                     }
        //                     if (endPosition) {
        //                         TouchHandler.drawPointer(ctx, endPosition.point);
        //                         if (startPosition) {
        //                             TouchHandler.drawLine(ctx, startPosition.point, endPosition.point);
        //                         }
        //                     }
        //                 }
        //                 if (e.type === 'mouseup') {
        //                     if (startPosition && endPosition) {
        //                         TouchHandler.clearCanvas(target);
        //                         if (startPosition.point.distance(endPosition.point) < 10) {
        //                             this.wdaConnection.wdaPerformClick(endPosition);
        //                         } else {
        //                             this.wdaConnection.wdaPerformScroll(startPosition, endPosition);
        //                         }
        //                     }
        //                 }
        //             }
        //             if (handled) {
        //                 if (e.cancelable) {
        //                     e.preventDefault();
        //                 }
        //                 e.stopPropagation();
        //             }
        //         }
        //         if (e.type === 'mouseup') {
        //             startPosition = undefined;
        //             endPosition = undefined;
        //         }
        //     };
        //     document.body.addEventListener('click', (e: MouseEvent): void => {
        //         onMouseEvent(e);
        //     });
        //     document.body.addEventListener('mousedown', (e: MouseEvent): void => {
        //         down++;
        //         onMouseEvent(e);
        //     });
        //     document.body.addEventListener('mouseup', (e: MouseEvent): void => {
        //         onMouseEvent(e);
        //         down--;
        //     });
        //     document.body.addEventListener('mousemove', (e: MouseEvent): void => {
        //         onMouseEvent(e);
        //     });
        //     this.hasTouchListeners = true;
        // }
    }
}
