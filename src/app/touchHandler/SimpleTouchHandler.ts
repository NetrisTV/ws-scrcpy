import { TouchEventNames, TouchHandler } from './TouchHandler';
import { BasePlayer } from '../player/BasePlayer';
import ScreenInfo from '../ScreenInfo';
import Position from '../Position';

export interface TouchHandlerListener {
    performClick: (position: Position) => void;
    performScroll: (from: Position, to: Position) => void;
}

const TAG = '[SimpleTouchHandler]';

export class SimpleTouchHandler extends TouchHandler {
    private startPosition?: Position;
    private endPosition?: Position;
    private static readonly touchEventsNames: TouchEventNames[] = ['mousedown', 'mouseup', 'mousemove'];
    private storage = new Map();

    constructor(player: BasePlayer, private readonly listener: TouchHandlerListener) {
        super(player, SimpleTouchHandler.touchEventsNames, []);
    }

    protected onTouchEvent(e: MouseEvent | TouchEvent): void {
        let handled = false;
        if (!(e instanceof MouseEvent)) {
            return;
        }
        if (e.target === this.tag) {
            const screenInfo: ScreenInfo = this.player.getScreenInfo() as ScreenInfo;
            if (!screenInfo) {
                return;
            }
            const events = this.buildTouchEvent(e, screenInfo, this.storage);
            if (events.length > 1) {
                console.log(TAG, 'Too many events', events);
                return;
            }
            if (events.length === 1) {
                handled = true;
                if (e.type === 'mousedown') {
                    this.startPosition = events[0].position;
                } else {
                    this.endPosition = events[0].position;
                }
                if (this.startPosition) {
                    this.drawPointer(this.startPosition.point);
                }
                if (this.endPosition) {
                    this.drawPointer(this.endPosition.point);
                    if (this.startPosition) {
                        this.drawLine(this.startPosition.point, this.endPosition.point);
                    }
                }
                if (e.type === 'mouseup') {
                    if (this.startPosition && this.endPosition) {
                        this.clearCanvas();
                        if (this.startPosition.point.distance(this.endPosition.point) < 10) {
                            this.listener.performClick(this.endPosition);
                        } else {
                            this.listener.performScroll(this.startPosition, this.endPosition);
                        }
                    }
                }
            }
            if (handled) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                e.stopPropagation();
            }
        }
        if (e.type === 'mouseup') {
            this.startPosition = undefined;
            this.endPosition = undefined;
        }
    }

    protected onKey(): void {
        throw Error(`${TAG} Unsupported`);
    }
}
