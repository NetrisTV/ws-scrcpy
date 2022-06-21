import { InteractionEvents, KeyEventNames, InteractionHandler } from './InteractionHandler';
import { BasePlayer } from '../player/BasePlayer';
import { ControlMessage } from '../controlMessage/ControlMessage';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import MotionEvent from '../MotionEvent';
import ScreenInfo from '../ScreenInfo';
import { ScrollControlMessage } from '../controlMessage/ScrollControlMessage';
const Mi10MainPath = require('../../public/json/mi10main.json')
const TAG = '[FeaturedTouchHandler]';

export interface InteractionHandlerListener {
    sendMessage: (message: ControlMessage) => void;
}

export class FeaturedInteractionHandler extends InteractionHandler {
    private static readonly touchEventsNames: InteractionEvents[] = [
        'touchstart',
        'touchend',
        'touchmove',
        'touchcancel',
        'mousedown',
        'mouseup',
        'mousemove',
        'wheel',
    ];
    private static readonly keyEventsNames: KeyEventNames[] = ['keydown', 'keyup'];
    public static SCROLL_EVENT_THROTTLING_TIME = 30; // one event per 50ms
    private readonly storedFromMouseEvent = new Map<number, TouchControlMessage>();
    private readonly storedFromTouchEvent = new Map<number, TouchControlMessage>();
    private lastScrollEvent?: { time: number; hScroll: number; vScroll: number };

    constructor(player: BasePlayer, public readonly listener: InteractionHandlerListener) {
        super(player, FeaturedInteractionHandler.touchEventsNames, FeaturedInteractionHandler.keyEventsNames);

// @ts-ignore
        window['mi10click'] = () => {
            Mi10MainPath.forEach( (item: TouchControlMessage) => {
                item['toBuffer'] = function () {
                    const buffer: Buffer = Buffer.alloc(TouchControlMessage.PAYLOAD_LENGTH + 1);
                    let offset = 0;
                    offset = buffer.writeUInt8(this.type, offset);
                    offset = buffer.writeUInt8(this.action, offset);
                    offset = buffer.writeUInt32BE(0, offset); // pointerId is `long` (8 bytes) on java side
                    offset = buffer.writeUInt32BE(this.pointerId, offset);
                    offset = buffer.writeUInt32BE(this.position.point.x, offset);
                    offset = buffer.writeUInt32BE(this.position.point.y, offset);
                    offset = buffer.writeUInt16BE(this.position.screenSize.width, offset);
                    offset = buffer.writeUInt16BE(this.position.screenSize.height, offset);
                    offset = buffer.writeUInt16BE(this.pressure * TouchControlMessage.MAX_PRESSURE_VALUE, offset);
                    buffer.writeUInt32BE(this.buttons, offset);
                    return buffer;
                }
                this.listener.sendMessage(item)
            })
        }
        this.tag.addEventListener('mouseleave', this.onMouseLeave);
        this.tag.addEventListener('mouseenter', this.onMouseEnter);
    }

    public buildScrollEvent(e: WheelEvent, screenInfo: ScreenInfo): ScrollControlMessage[] {
        const messages: ScrollControlMessage[] = [];
        const touchOnClient = InteractionHandler.buildTouchOnClient(e, screenInfo);
        if (touchOnClient) {
            const hScroll = e.deltaX > 0 ? -1 : e.deltaX < -0 ? 1 : 0;
            const vScroll = e.deltaY > 0 ? -1 : e.deltaY < -0 ? 1 : 0;
            const time = Date.now();
            if (
                !this.lastScrollEvent ||
                time - this.lastScrollEvent.time > FeaturedInteractionHandler.SCROLL_EVENT_THROTTLING_TIME ||
                this.lastScrollEvent.vScroll !== vScroll ||
                this.lastScrollEvent.hScroll !== hScroll
            ) {
                this.lastScrollEvent = { time, hScroll, vScroll };
                messages.push(new ScrollControlMessage(touchOnClient.touch.position, hScroll, vScroll));
            }
        }
        return messages;
    }

    protected onInteraction(e: MouseEvent | TouchEvent): void {
        const screenInfo = this.player.getScreenInfo();
        if (!screenInfo) {
            return;
        }
        let messages: ControlMessage[];
        let storage: Map<number, TouchControlMessage>;
        if (e instanceof MouseEvent) {
            if (e.target !== this.tag) {
                return;
            }
            if (window['WheelEvent'] && e instanceof WheelEvent) {
                messages = this.buildScrollEvent(e, screenInfo);
            } else {
                storage = this.storedFromMouseEvent;
                messages = this.buildTouchEvent(e, screenInfo, storage);
            }
            if (this.over) {
                this.lastPosition = e;
            }
        } else if (window['TouchEvent'] && e instanceof TouchEvent) {
            // TODO: Research drag from out of the target inside it
            if (e.target !== this.tag) {
                return;
            }
            storage = this.storedFromTouchEvent;
            messages = this.formatTouchEvent(e, screenInfo, storage);
        } else {
            console.error(TAG, 'Unsupported event', e);
            return;
        }
        if (e.cancelable) {
            e.preventDefault();
        }
        e.stopPropagation();


        // @ts-ignore
        if (!window['templist']) window['templist'] = [];
        // @ts-ignore
        window['templist'].push(messages[0])


        console.log(messages, this.listener, e)
        messages.forEach((message) => {
            this.listener.sendMessage(message);
        });
    }

    protected onKey(e: KeyboardEvent): void {
        if (!this.lastPosition) {
            return;
        }
        const screenInfo = this.player.getScreenInfo();
        if (!screenInfo) {
            return;
        }
        const { ctrlKey, shiftKey } = e;
        const { target, button, buttons, clientY, clientX } = this.lastPosition;
        const type = InteractionHandler.SIMULATE_MULTI_TOUCH;
        const event = { ctrlKey, shiftKey, type, target, button, buttons, clientX, clientY };
        this.buildTouchEvent(event, screenInfo, new Map());
    }

    private onMouseEnter = (): void => {
        this.over = true;
    };
    private onMouseLeave = (): void => {
        this.lastPosition = undefined;
        this.over = false;
        this.storedFromMouseEvent.forEach((message) => {
            this.listener.sendMessage(InteractionHandler.createEmulatedMessage(MotionEvent.ACTION_UP, message));
        });
        this.storedFromMouseEvent.clear();
        this.clearCanvas();
    };

    public release(): void {
        super.release();
        this.tag.removeEventListener('mouseleave', this.onMouseLeave);
        this.tag.removeEventListener('mouseenter', this.onMouseEnter);
        this.storedFromMouseEvent.clear();
    }
}
