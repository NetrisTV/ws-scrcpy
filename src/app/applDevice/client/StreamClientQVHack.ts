import { BaseClient } from '../../client/BaseClient';
import { QVHackMoreBox } from '../toolbox/QVHackMoreBox';
import { QVHackToolBox } from '../toolbox/QVHackToolBox';
import WdaConnection from '../WdaConnection';
import { WsQVHackClient } from './WsQVHackClient';
import Size from '../../Size';
import ScreenInfo from '../../ScreenInfo';
import { StreamReceiver } from '../../client/StreamReceiver';
import Position from '../../Position';
import { MsePlayerForQVHack } from '../../player/MsePlayerForQVHack';
import { BasePlayer, PlayerClass } from '../../player/BasePlayer';
import { SimpleInteractionHandler, TouchHandlerListener } from '../../interactionHandler/SimpleInteractionHandler';
import { ACTION } from '../../../common/Action';
import { ParsedUrlQuery } from 'querystring';
import Util from '../../Util';
import { ParamsStreamQVHack } from '../../../types/ParamsStreamQVHack';
import { StreamReceiverQVHack } from './StreamReceiverQVHack';

const WAIT_CLASS = 'wait';

const TAG = '[StreamClientQVHack]';

export class StreamClientQVHack extends BaseClient<ParamsStreamQVHack, never> implements TouchHandlerListener {
    public static ACTION = ACTION.STREAM_WS_QVH;
    private static players: Map<string, PlayerClass> = new Map<string, PlayerClass>();
    private deviceName = '';
    private managerClient: WsQVHackClient;
    private wdaConnection = new WdaConnection();
    private waitForWda?: boolean;
    private readonly streamReceiver: StreamReceiver<ParamsStreamQVHack>;
    private videoWrapper?: HTMLElement;
    private touchHandler?: SimpleInteractionHandler;
    private readonly udid: string;

    public static registerPlayer(playerClass: PlayerClass): void {
        if (playerClass.isSupported()) {
            this.players.set(playerClass.playerFullName, playerClass);
        }
    }

    public static getPlayers(): PlayerClass[] {
        return Array.from(this.players.values());
    }

    private static getPlayerClass(playerName?: string): PlayerClass | undefined {
        let playerClass: PlayerClass | undefined;
        for (const value of this.players.values()) {
            if (value.playerFullName === playerName || value.playerCodeName === playerName) {
                playerClass = value;
            }
        }
        if (!playerClass) {
            return MsePlayerForQVHack;
        }
        return playerClass;
    }

    public static createPlayer(udid: string, playerName?: string): BasePlayer {
        const playerClass = this.getPlayerClass(playerName);
        if (!playerClass) {
            return new MsePlayerForQVHack(udid);
        }
        return new playerClass(udid);
    }

    public static start(params: ParsedUrlQuery | ParamsStreamQVHack): StreamClientQVHack {
        return new StreamClientQVHack(params);
    }

    constructor(params: ParsedUrlQuery | ParamsStreamQVHack) {
        super(params);

        this.udid = this.params.udid;
        let udid = this.udid;
        // Workaround for qvh v0.5-beta
        if (udid.indexOf('-') !== -1) {
            udid = udid.replace('-', '');
            udid = udid + '\0'.repeat(16);
        }
        this.managerClient = new WsQVHackClient({ ...this.params, action: ACTION.PROXY_WDA });
        this.streamReceiver = new StreamReceiverQVHack({ ...this.params, udid });
        this.startStream();
        this.setTitle(`${this.udid} stream`);
        this.setBodyClass('stream');
    }

    public parseParameters(params: ParsedUrlQuery): ParamsStreamQVHack {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.STREAM_WS_QVH) {
            throw Error('Incorrect action');
        }
        return {
            ...typedParams,
            action,
            udid: Util.parseStringEnv(params.udid),
            player: Util.parseStringEnv(params.player),
        };
    }

    private onViewVideoResize = (): void => {
        this.runWebDriverAgent();
    };
    private onInputVideoResize = (screenInfo: ScreenInfo): void => {
        this.wdaConnection.setScreenInfo(screenInfo);
    };

    private runWebDriverAgent() {
        if (typeof this.waitForWda === 'boolean') {
            return;
        }

        this.waitForWda = true;
        this.managerClient
            .runWebDriverAgent(this.udid)
            .then((response) => {
                this.waitForWda = false;
                const data = response.data;
                if (data.code === 0) {
                    this.wdaConnection.setClient(this.managerClient);
                } else {
                    console.error(TAG, `Failed to run WebDriverAgent. Reason: ${data.text}, code: ${data.code}`);
                }
            })
            .finally(() => {
                this.videoWrapper?.classList.remove(WAIT_CLASS);
            });
    }

    private startStream(inputPlayer?: BasePlayer) {
        const { udid, player: playerName } = this.params;
        if (!udid) {
            throw Error(`Invalid udid value: "${udid}"`);
        }
        let player: BasePlayer;
        if (inputPlayer) {
            player = inputPlayer;
        } else {
            player = StreamClientQVHack.createPlayer(udid, playerName);
        }
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

        document.body.appendChild(deviceView);
        const bounds = StreamClientQVHack.getMaxSize(controlButtons);
        if (bounds) {
            player.setBounds(bounds);
        }
        this.streamReceiver.on('video', (data) => {
            const STATE = BasePlayer.STATE;
            if (player.getState() === STATE.PAUSED) {
                player.play();
            }
            if (player.getState() === STATE.PLAYING) {
                player.pushFrame(new Uint8Array(data));
            }
        });
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
        this.touchHandler = new SimpleInteractionHandler(player, this);
    }

    public performClick(position: Position): void {
        this.wdaConnection.wdaPerformClick(position);
    }

    public performScroll(from: Position, to: Position): void {
        this.wdaConnection.wdaPerformScroll(from, to);
    }
}
