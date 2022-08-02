import MotionEvent from '../MotionEvent';
import ScreenInfo from '../ScreenInfo';
import { TouchControlMessage } from '../controlMessage/TouchControlMessage';
import Size from '../Size';
import Point from '../Point';
import Position from '../Position';
import TouchPointPNG from '../../public/images/multitouch/touch_point.png';
import CenterPointPNG from '../../public/images/multitouch/center_point.png';
import Util from '../Util';
import { BasePlayer } from '../player/BasePlayer';

interface Touch {
    action: number;
    position: Position;
    buttons: number;
    invalid: boolean;
}

interface TouchOnClient {
    client: {
        width: number;
        height: number;
    };
    touch: Touch;
}

interface CommonTouchAndMouse {
    clientX: number;
    clientY: number;
    type: string;
    target: EventTarget | null;
    buttons: number;
}

interface MiniMouseEvent extends CommonTouchAndMouse {
    ctrlKey: boolean;
    shiftKey: boolean;
    buttons: number;
}

const TAG = '[TouchHandler]';

export type TouchEventNames =
    | 'touchstart'
    | 'touchend'
    | 'touchmove'
    | 'touchcancel'
    | 'mousedown'
    | 'mouseup'
    | 'mousemove';
export type WheelEventNames = 'wheel';
export type InteractionEvents = TouchEventNames | WheelEventNames;
export type KeyEventNames = 'keydown' | 'keyup';

export abstract class InteractionHandler {
    protected static readonly SIMULATE_MULTI_TOUCH = 'SIMULATE_MULTI_TOUCH';
    protected static readonly STROKE_STYLE: string = '#00BEA4';
    protected static EVENT_ACTION_MAP: Record<string, number> = {
        touchstart: MotionEvent.ACTION_DOWN,
        touchend: MotionEvent.ACTION_UP,
        touchmove: MotionEvent.ACTION_MOVE,
        touchcancel: MotionEvent.ACTION_UP,
        mousedown: MotionEvent.ACTION_DOWN,
        mousemove: MotionEvent.ACTION_MOVE,
        mouseup: MotionEvent.ACTION_UP,
        [InteractionHandler.SIMULATE_MULTI_TOUCH]: -1,
    };
    private static options = Util.supportsPassive() ? { passive: false } : false;
    private static idToPointerMap: Map<number, number> = new Map();
    private static pointerToIdMap: Map<number, number> = new Map();
    private static touchPointRadius = 10;
    private static centerPointRadius = 5;
    private static touchPointImage?: HTMLImageElement;
    private static centerPointImage?: HTMLImageElement;
    private static pointImagesLoaded = false;
    private static eventListeners: Map<string, Set<InteractionHandler>> = new Map();
    private multiTouchActive = false;
    private multiTouchCenter?: Point;
    private multiTouchShift = false;
    private dirtyPlace: Point[] = [];
    protected readonly ctx: CanvasRenderingContext2D | null;
    protected readonly tag: HTMLCanvasElement;
    protected over = false;
    protected lastPosition?: MouseEvent;

    protected constructor(
        public readonly player: BasePlayer,
        public readonly touchEventsNames: InteractionEvents[],
        public readonly keyEventsNames: KeyEventNames[],
    ) {
        this.tag = player.getTouchableElement();
        this.ctx = this.tag.getContext('2d');
        InteractionHandler.loadImages();
        InteractionHandler.bindGlobalListeners(this);
    }

    protected abstract onInteraction(event: MouseEvent | TouchEvent): void;
    protected abstract onKey(event: KeyboardEvent): void;

    protected static bindGlobalListeners(interactionHandler: InteractionHandler): void {
        interactionHandler.touchEventsNames.forEach((eventName) => {
            let set: Set<InteractionHandler> | undefined = InteractionHandler.eventListeners.get(eventName);
            if (!set) {
                set = new Set();
                document.body.addEventListener(eventName, this.onInteractionEvent, InteractionHandler.options);
                this.eventListeners.set(eventName, set);
            }
            set.add(interactionHandler);
        });
        interactionHandler.keyEventsNames.forEach((eventName) => {
            let set = InteractionHandler.eventListeners.get(eventName);
            if (!set) {
                set = new Set();
                document.body.addEventListener(eventName, this.onKeyEvent);
                this.eventListeners.set(eventName, set);
            }
            set.add(interactionHandler);
        });
    }

    protected static unbindListeners(touchHandler: InteractionHandler): void {
        touchHandler.touchEventsNames.forEach((eventName) => {
            const set = InteractionHandler.eventListeners.get(eventName);
            if (!set) {
                return;
            }
            set.delete(touchHandler);
            if (set.size <= 0) {
                this.eventListeners.delete(eventName);
                document.body.removeEventListener(eventName, this.onInteractionEvent);
            }
        });
        touchHandler.keyEventsNames.forEach((eventName) => {
            const set = InteractionHandler.eventListeners.get(eventName);
            if (!set) {
                return;
            }
            set.delete(touchHandler);
            if (set.size <= 0) {
                this.eventListeners.delete(eventName);
                document.body.removeEventListener(eventName, this.onKeyEvent);
            }
        });
    }

    protected static onInteractionEvent = (event: MouseEvent | TouchEvent): void => {
        const set = InteractionHandler.eventListeners.get(event.type as TouchEventNames);
        if (!set) {
            return;
        }
        set.forEach((instance) => {
            instance.onInteraction(event);
        });
    };

    protected static onKeyEvent = (event: KeyboardEvent): void => {
        const set = InteractionHandler.eventListeners.get(event.type as KeyEventNames);
        if (!set) {
            return;
        }
        set.forEach((instance) => {
            instance.onKey(event);
        });
    };

    protected static loadImages(): void {
        if (this.pointImagesLoaded) {
            return;
        }
        const total = 2;
        let current = 0;

        const onload = (event: Event) => {
            if (++current === total) {
                this.pointImagesLoaded = true;
            }
            if (event.target === this.touchPointImage) {
                this.touchPointRadius = this.touchPointImage.width / 2;
            } else if (event.target === this.centerPointImage) {
                this.centerPointRadius = this.centerPointImage.width / 2;
            }
        };
        const touch = (this.touchPointImage = new Image());
        touch.src = TouchPointPNG;
        touch.onload = onload;
        const center = (this.centerPointImage = new Image());
        center.src = CenterPointPNG;
        center.onload = onload;
    }

    protected static getPointerId(type: string, identifier: number): number {
        if (this.idToPointerMap.has(identifier)) {
            const pointerId = this.idToPointerMap.get(identifier) as number;
            if (type === 'touchend' || type === 'touchcancel') {
                this.idToPointerMap.delete(identifier);
                this.pointerToIdMap.delete(pointerId);
            }
            return pointerId;
        }
        let pointerId = 0;
        while (this.pointerToIdMap.has(pointerId)) {
            pointerId++;
        }
        this.idToPointerMap.set(identifier, pointerId);
        this.pointerToIdMap.set(pointerId, identifier);
        return pointerId;
    }

    protected static buildTouchOnClient(event: CommonTouchAndMouse, screenInfo: ScreenInfo): TouchOnClient | null {
        const action = this.mapTypeToAction(event.type);
        const { width, height } = screenInfo.videoSize;
        const target: HTMLElement = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        let { clientWidth, clientHeight } = target;
        let touchX = event.clientX - rect.left;
        let touchY = event.clientY - rect.top;
        let invalid = false;
        if (touchX < 0 || touchX > clientWidth || touchY < 0 || touchY > clientHeight) {
            invalid = true;
        }
        const eps = 1e5;
        const ratio = width / height;
        const shouldBe = Math.round(eps * ratio);
        const haveNow = Math.round((eps * clientWidth) / clientHeight);
        if (shouldBe > haveNow) {
            const realHeight = Math.ceil(clientWidth / ratio);
            const top = (clientHeight - realHeight) / 2;
            if (touchY < top || touchY > top + realHeight) {
                invalid = true;
            }
            touchY -= top;
            clientHeight = realHeight;
        } else if (shouldBe < haveNow) {
            const realWidth = Math.ceil(clientHeight * ratio);
            const left = (clientWidth - realWidth) / 2;
            if (touchX < left || touchX > left + realWidth) {
                invalid = true;
            }
            touchX -= left;
            clientWidth = realWidth;
        }
        const x = (touchX * width) / clientWidth;
        const y = (touchY * height) / clientHeight;
        const size = new Size(width, height);
        const point = new Point(x, y);
        const position = new Position(point, size);
        if (x < 0 || y < 0 || x > width || y > height) {
            invalid = true;
        }
        return {
            client: {
                width: clientWidth,
                height: clientHeight,
            },
            touch: {
                invalid,
                action,
                position,
                buttons: event.buttons,
            },
        };
    }

    private static validateMessage(
        originalEvent: MiniMouseEvent | TouchEvent,
        message: TouchControlMessage,
        storage: Map<number, TouchControlMessage>,
        logPrefix: string,
    ): TouchControlMessage[] {
        const messages: TouchControlMessage[] = [];
        const { action, pointerId } = message;
        const previous = storage.get(pointerId);
        if (action === MotionEvent.ACTION_UP) {
            if (!previous) {
                console.warn(logPrefix, 'Received ACTION_UP while there are no DOWN stored');
            } else {
                storage.delete(pointerId);
                messages.push(message);
            }
        } else if (action === MotionEvent.ACTION_DOWN) {
            if (previous) {
                console.warn(logPrefix, 'Received ACTION_DOWN while already has one stored');
            } else {
                storage.set(pointerId, message);
                messages.push(message);
            }
        } else if (action === MotionEvent.ACTION_MOVE) {
            if (!previous) {
                if (
                    (originalEvent instanceof MouseEvent && originalEvent.buttons) ||
                    (window['TouchEvent'] && originalEvent instanceof TouchEvent)
                ) {
                    console.warn(logPrefix, 'Received ACTION_MOVE while there are no DOWN stored');
                    const emulated = InteractionHandler.createEmulatedMessage(MotionEvent.ACTION_DOWN, message);
                    messages.push(emulated);
                    storage.set(pointerId, emulated);
                }
            } else {
                messages.push(message);
                storage.set(pointerId, message);
            }
        }
        return messages;
    }

    protected static createEmulatedMessage(action: number, event: TouchControlMessage): TouchControlMessage {
        const { pointerId, position, buttons } = event;
        let pressure = event.pressure;
        if (action === MotionEvent.ACTION_UP) {
            pressure = 0;
        }
        return new TouchControlMessage(action, pointerId, position, pressure, buttons);
    }

    public static mapTypeToAction(type: string): number {
        return this.EVENT_ACTION_MAP[type];
    }

    protected getTouch(
        e: CommonTouchAndMouse,
        screenInfo: ScreenInfo,
        ctrlKey: boolean,
        shiftKey: boolean,
    ): Touch[] | null {
        const touchOnClient = InteractionHandler.buildTouchOnClient(e, screenInfo);
        if (!touchOnClient) {
            return null;
        }
        const { client, touch } = touchOnClient;
        const result: Touch[] = [touch];
        if (!ctrlKey) {
            this.multiTouchActive = false;
            this.multiTouchCenter = undefined;
            this.multiTouchShift = false;
            this.clearCanvas();
            return result;
        }
        const { position, action, buttons } = touch;
        const { point, screenSize } = position;
        const { width, height } = screenSize;
        const { x, y } = point;
        if (!this.multiTouchActive) {
            if (shiftKey) {
                this.multiTouchCenter = point;
                this.multiTouchShift = true;
            } else {
                this.multiTouchCenter = new Point(client.width / 2, client.height / 2);
            }
        }
        this.multiTouchActive = true;
        let opposite: Point | undefined;
        let invalid = false;
        if (this.multiTouchShift && this.multiTouchCenter) {
            const oppoX = 2 * this.multiTouchCenter.x - x;
            const oppoY = 2 * this.multiTouchCenter.y - y;
            opposite = new Point(oppoX, oppoY);
            if (!(oppoX <= width && oppoX >= 0 && oppoY <= height && oppoY >= 0)) {
                invalid = true;
            }
        } else {
            opposite = new Point(client.width - x, client.height - y);
            invalid = touch.invalid;
        }
        if (opposite) {
            result.push({
                invalid,
                action,
                buttons,
                position: new Position(opposite, screenSize),
            });
        }
        return result;
    }

    protected drawCircle(ctx: CanvasRenderingContext2D, point: Point, radius: number): void {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, true);
        ctx.stroke();
    }

    public drawLine(point1: Point, point2: Point): void {
        if (!this.ctx) {
            return;
        }
        this.ctx.save();
        this.ctx.strokeStyle = InteractionHandler.STROKE_STYLE;
        this.ctx.beginPath();
        this.ctx.moveTo(point1.x, point1.y);
        this.ctx.lineTo(point2.x, point2.y);
        this.ctx.stroke();
        this.ctx.restore();
    }

    protected drawPoint(point: Point, radius: number, image?: HTMLImageElement): void {
        if (!this.ctx) {
            return;
        }
        let { lineWidth } = this.ctx;
        if (InteractionHandler.pointImagesLoaded && image) {
            radius = image.width / 2;
            lineWidth = 0;
            this.ctx.drawImage(image, point.x - radius, point.y - radius);
        } else {
            this.drawCircle(this.ctx, point, radius);
        }

        const topLeft = new Point(point.x - radius - lineWidth, point.y - radius - lineWidth);
        const bottomRight = new Point(point.x + radius + lineWidth, point.y + radius + lineWidth);
        this.updateDirty(topLeft, bottomRight);
    }

    public drawPointer(point: Point): void {
        this.drawPoint(point, InteractionHandler.touchPointRadius, InteractionHandler.touchPointImage);
        if (this.multiTouchCenter) {
            this.drawLine(this.multiTouchCenter, point);
        }
    }

    public drawCenter(point: Point): void {
        this.drawPoint(point, InteractionHandler.centerPointRadius, InteractionHandler.centerPointImage);
    }

    protected updateDirty(topLeft: Point, bottomRight: Point): void {
        if (!this.dirtyPlace.length) {
            this.dirtyPlace.push(topLeft, bottomRight);
            return;
        }
        const currentTopLeft = this.dirtyPlace[0];
        const currentBottomRight = this.dirtyPlace[1];
        const newTopLeft = new Point(Math.min(currentTopLeft.x, topLeft.x), Math.min(currentTopLeft.y, topLeft.y));
        const newBottomRight = new Point(
            Math.max(currentBottomRight.x, bottomRight.x),
            Math.max(currentBottomRight.y, bottomRight.y),
        );
        this.dirtyPlace.length = 0;
        this.dirtyPlace.push(newTopLeft, newBottomRight);
    }

    public clearCanvas(): void {
        const { clientWidth, clientHeight } = this.tag;
        const ctx = this.ctx;
        if (ctx && this.dirtyPlace.length) {
            const topLeft = this.dirtyPlace[0];
            const bottomRight = this.dirtyPlace[1];
            this.dirtyPlace.length = 0;
            const x = Math.max(topLeft.x, 0);
            const y = Math.max(topLeft.y, 0);
            const w = Math.min(clientWidth, bottomRight.x - x);
            const h = Math.min(clientHeight, bottomRight.y - y);
            ctx.clearRect(x, y, w, h);
            ctx.strokeStyle = InteractionHandler.STROKE_STYLE;
        }
    }

    public formatTouchEvent(
        e: TouchEvent,
        screenInfo: ScreenInfo,
        storage: Map<number, TouchControlMessage>,
    ): TouchControlMessage[] {
        const logPrefix = `${TAG}[formatTouchEvent]`;
        const messages: TouchControlMessage[] = [];
        const touches = e.changedTouches;
        if (touches && touches.length) {
            for (let i = 0, l = touches.length; i < l; i++) {
                const touch = touches[i];
                const pointerId = InteractionHandler.getPointerId(e.type, touch.identifier);
                if (touch.target !== this.tag) {
                    continue;
                }
                const previous = storage.get(pointerId);
                const item: CommonTouchAndMouse = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    type: e.type,
                    buttons: MotionEvent.BUTTON_PRIMARY,
                    target: e.target,
                };
                const event = InteractionHandler.buildTouchOnClient(item, screenInfo);
                if (event) {
                    const { action, buttons, position, invalid } = event.touch;
                    let pressure = 1;
                    if (action === MotionEvent.ACTION_UP) {
                        pressure = 0;
                    } else if (typeof touch.force === 'number') {
                        pressure = touch.force;
                    }
                    if (!invalid) {
                        const message = new TouchControlMessage(action, pointerId, position, pressure, buttons);
                        messages.push(
                            ...InteractionHandler.validateMessage(e, message, storage, `${logPrefix}[validate]`),
                        );
                    } else {
                        if (previous) {
                            messages.push(InteractionHandler.createEmulatedMessage(MotionEvent.ACTION_UP, previous));
                            storage.delete(pointerId);
                        }
                    }
                } else {
                    console.error(logPrefix, `Failed to format touch`, touch);
                }
            }
        } else {
            console.error(logPrefix, 'No "touches"', e);
        }
        return messages;
    }

    public buildTouchEvent(
        e: MiniMouseEvent,
        screenInfo: ScreenInfo,
        storage: Map<number, TouchControlMessage>,
    ): TouchControlMessage[] {
        const logPrefix = `${TAG}[buildTouchEvent]`;
        const touches = this.getTouch(e, screenInfo, e.ctrlKey, e.shiftKey);
        if (!touches) {
            return [];
        }
        const messages: TouchControlMessage[] = [];
        const points: Point[] = [];
        this.clearCanvas();
        touches.forEach((touch: Touch, pointerId: number) => {
            const { action, buttons, position } = touch;
            const previous = storage.get(pointerId);
            if (!touch.invalid) {
                let pressure = 1.0;
                if (action === MotionEvent.ACTION_UP) {
                    pressure = 0;
                }
                const message = new TouchControlMessage(action, pointerId, position, pressure, buttons);
                messages.push(...InteractionHandler.validateMessage(e, message, storage, `${logPrefix}[validate]`));
                points.push(touch.position.point);
            } else {
                if (previous) {
                    points.push(previous.position.point);
                }
            }
        });
        if (this.multiTouchActive) {
            if (this.multiTouchCenter) {
                this.drawCenter(this.multiTouchCenter);
            }
            points.forEach((point) => {
                this.drawPointer(point);
            });
        }
        const hasActionUp = messages.find((message) => {
            return message.action === MotionEvent.ACTION_UP;
        });
        if (hasActionUp && storage.size) {
            console.warn(logPrefix, 'Looks like one of Multi-touch pointers was not raised up');
            storage.forEach((message) => {
                messages.push(InteractionHandler.createEmulatedMessage(MotionEvent.ACTION_UP, message));
            });
            storage.clear();
        }
        return messages;
    }

    public release(): void {
        InteractionHandler.unbindListeners(this);
    }
}
