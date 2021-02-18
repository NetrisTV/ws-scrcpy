import { KeyEventNames, TouchEventNames, TouchHandler } from './TouchHandler';
import { BasePlayer } from '../player/BasePlayer';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import MotionEvent from '../MotionEvent';

const TAG = '[FeaturedTouchHandler]';

export interface TouchHandlerListener {
    sendMessage: (messages: TouchControlMessage) => void;
}

export class FeaturedTouchHandler extends TouchHandler {
    private readonly storedFromMouseEvent = new Map<number, TouchControlMessage>();
    private readonly storedFromTouchEvent = new Map<number, TouchControlMessage>();
    private static readonly touchEventsNames: TouchEventNames[] = [
        'touchstart',
        'touchend',
        'touchmove',
        'touchcancel',
        'mousedown',
        'mouseup',
        'mousemove',
    ];
    private static readonly keyEventsNames: KeyEventNames[] = ['keydown', 'keyup'];

    constructor(player: BasePlayer, public readonly listener: TouchHandlerListener) {
        super(player, FeaturedTouchHandler.touchEventsNames, FeaturedTouchHandler.keyEventsNames);
        this.tag.addEventListener('mouseleave', this.onMouseLeave);
        this.tag.addEventListener('mouseenter', this.onMouseEnter);
    }

    protected onTouchEvent(e: MouseEvent | TouchEvent): void {
        const screenInfo = this.player.getScreenInfo();
        if (!screenInfo) {
            return;
        }
        let messages: TouchControlMessage[];
        let storage: Map<number, TouchControlMessage>;
        if (e instanceof MouseEvent) {
            if (e.target !== this.tag) {
                return;
            }
            storage = this.storedFromMouseEvent;
            messages = this.buildTouchEvent(e, screenInfo, storage);
            if (this.over) {
                this.lastPosition = e;
            }
        } else if (e instanceof TouchEvent) {
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
        const type = TouchHandler.SIMULATE_MULTI_TOUCH;
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
            this.listener.sendMessage(TouchHandler.createEmulatedMessage(MotionEvent.ACTION_UP, message));
        });
        this.storedFromMouseEvent.clear();
        this.clearCanvas();
    };

    public release(): void {
        super.release();
        this.tag.removeEventListener('mouseleave', this.onMouseLeave);
        this.tag.removeEventListener('mouseenter', this.onMouseEnter);
        this.storedFromMouseEvent.clear();
        this.storedFromMouseEvent.clear();
    }
}
