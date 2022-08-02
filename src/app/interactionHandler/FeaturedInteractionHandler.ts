import { InteractionEvents, KeyEventNames, InteractionHandler } from './InteractionHandler';
import { BasePlayer } from '../player/BasePlayer';
import { ControlMessage } from '../controlMessage/ControlMessage';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import MotionEvent from '../MotionEvent';
import ScreenInfo from '../ScreenInfo';
import { ScrollControlMessage } from '../controlMessage/ScrollControlMessage';

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
        this.tag.addEventListener('mouseleave', this.onMouseLeave);
        this.tag.addEventListener('mouseenter', this.onMouseEnter);
    }

    public buildScrollEvent(event: WheelEvent, screenInfo: ScreenInfo): ScrollControlMessage[] {
        const messages: ScrollControlMessage[] = [];
        const touchOnClient = InteractionHandler.buildTouchOnClient(event, screenInfo);
        if (touchOnClient) {
            const hScroll = event.deltaX > 0 ? -1 : event.deltaX < -0 ? 1 : 0;
            const vScroll = event.deltaY > 0 ? -1 : event.deltaY < -0 ? 1 : 0;
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

    protected onInteraction(event: MouseEvent | TouchEvent): void {
        const screenInfo = this.player.getScreenInfo();
        if (!screenInfo) {
            return;
        }
        let messages: ControlMessage[];
        let storage: Map<number, TouchControlMessage>;
        if (event instanceof MouseEvent) {
            if (event.target !== this.tag) {
                return;
            }
            if (window['WheelEvent'] && event instanceof WheelEvent) {
                messages = this.buildScrollEvent(event, screenInfo);
            } else {
                storage = this.storedFromMouseEvent;
                messages = this.buildTouchEvent(event, screenInfo, storage);
            }
            if (this.over) {
                this.lastPosition = event;
            }
        } else if (window['TouchEvent'] && event instanceof TouchEvent) {
            // TODO: Research drag from out of the target inside it
            if (event.target !== this.tag) {
                return;
            }
            storage = this.storedFromTouchEvent;
            messages = this.formatTouchEvent(event, screenInfo, storage);
        } else {
            console.error(TAG, 'Unsupported event', event);
            return;
        }
        if (event.cancelable) {
            event.preventDefault();
        }
        event.stopPropagation();
        messages.forEach((message) => {
            this.listener.sendMessage(message);
        });
    }

    protected onKey(event: KeyboardEvent): void {
        if (!this.lastPosition) {
            return;
        }
        const screenInfo = this.player.getScreenInfo();
        if (!screenInfo) {
            return;
        }
        const { ctrlKey, shiftKey } = event;
        const { target, button, buttons, clientY, clientX } = this.lastPosition;
        const type = InteractionHandler.SIMULATE_MULTI_TOUCH;
        const props = { ctrlKey, shiftKey, type, target, button, buttons, clientX, clientY };
        this.buildTouchEvent(props, screenInfo, new Map());
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
