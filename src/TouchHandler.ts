import MotionEvent from './MotionEvent';
import ScreenInfo from './ScreenInfo';
import TouchControlEvent from './controlEvent/TouchControlEvent';
import Size from './Size';
import Point from './Point';
import Position from './Position';
import TouchPointPNG from '../images/multitouch/touch_point.png';
import CenterPointPNG from '../images/multitouch/center_point.png';

interface Touch {
    action: number;
    position: Position;
    buttons: number;
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
    button: number;
}

export default class TouchHandler {
    private static readonly STROKE_STYLE: string = '#00BEA4';
    private static BUTTONS_MAP: Record<number, number> = {
        0: 17, // ?? BUTTON_PRIMARY
        1: MotionEvent.BUTTON_TERTIARY,
        2: 26, // ?? BUTTON_SECONDARY
    };
    private static EVENT_ACTION_MAP: Record<string, number> = {
        touchstart: MotionEvent.ACTION_DOWN,
        touchend: MotionEvent.ACTION_UP,
        touchmove: MotionEvent.ACTION_MOVE,
        touchcancel: MotionEvent.ACTION_UP,
        mousedown: MotionEvent.ACTION_DOWN,
        mousemove: MotionEvent.ACTION_MOVE,
        mouseup: MotionEvent.ACTION_UP,
    };
    private static multiTouchActive = false;
    private static multiTouchCenter?: Point;
    private static multiTouchShift = false;
    private static dirtyPlace: Point[] = [];
    private static idToPointerMap: Map<number, number> = new Map();
    private static pointerToIdMap: Map<number, number> = new Map();
    private static touchPointRadius = 10;
    private static centerPointRadius = 5;
    private static touchPointImage?: HTMLImageElement;
    private static centerPointImage?: HTMLImageElement;
    private static pointImagesLoaded = false;
    private static initialized = false;

    public static init(): void {
        if (this.initialized) {
            return;
        }
        this.loadImages();
        this.initialized = true;
    }

    private static loadImages(): void {
        const total = 2;
        let current = 0;

        const onload = (e: Event) => {
            if (++current === total) {
                this.pointImagesLoaded = true;
            }
            if (e.target === this.touchPointImage) {
                this.touchPointRadius = this.touchPointImage.width / 2;
            } else if (e.target === this.centerPointImage) {
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

    private static getPointerId(type: string, identifier: number): number {
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

    private static calculateCoordinates(e: CommonTouchAndMouse, screenInfo: ScreenInfo): TouchOnClient | null {
        const action = this.EVENT_ACTION_MAP[e.type];
        if (typeof action === 'undefined' || !screenInfo) {
            return null;
        }
        const htmlTag = document.getElementsByTagName('html')[0] as HTMLElement;
        const { width, height } = screenInfo.videoSize;
        const target: HTMLElement = e.target as HTMLElement;
        const { scrollTop, scrollLeft } = htmlTag;
        let { clientWidth, clientHeight } = target;
        let touchX = e.clientX - target.offsetLeft + scrollLeft;
        let touchY = e.clientY - target.offsetTop + scrollTop;
        const eps = 1e5;
        const ratio = width / height;
        const shouldBe = Math.round(eps * ratio);
        const haveNow = Math.round((eps * clientWidth) / clientHeight);
        if (shouldBe > haveNow) {
            const realHeight = Math.ceil(clientWidth / ratio);
            const top = (clientHeight - realHeight) / 2;
            if (touchY < top || touchY > top + realHeight) {
                return null;
            }
            touchY -= top;
            clientHeight = realHeight;
        } else if (shouldBe < haveNow) {
            const realWidth = Math.ceil(clientHeight * ratio);
            const left = (clientWidth - realWidth) / 2;
            if (touchX < left || touchX > left + realWidth) {
                return null;
            }
            touchX -= left;
            clientWidth = realWidth;
        }
        const x = (touchX * width) / clientWidth;
        const y = (touchY * height) / clientHeight;
        const size = new Size(width, height);
        const point = new Point(x, y);
        const position = new Position(point, size);
        const buttons = this.BUTTONS_MAP[e.button];
        return {
            client: {
                width: clientWidth,
                height: clientHeight,
            },
            touch: {
                action,
                position,
                buttons,
            },
        };
    }

    private static getTouch(e: MouseEvent, screenInfo: ScreenInfo): Touch[] | null {
        const touchOnClient = this.calculateCoordinates(e, screenInfo);
        if (!touchOnClient) {
            return null;
        }
        const { client, touch } = touchOnClient;
        const result: Touch[] = [touch];
        if (!e.ctrlKey) {
            this.multiTouchActive = false;
            this.multiTouchCenter = undefined;
            this.multiTouchShift = false;
            this.clearCanvas(e.target as HTMLCanvasElement);
            return result;
        }
        const { position, action, buttons } = touch;
        const { point, screenSize } = position;
        const { width, height } = screenSize;
        const { x, y } = point;
        if (!this.multiTouchActive) {
            if (e.shiftKey) {
                this.multiTouchCenter = point;
                this.multiTouchShift = true;
            } else {
                this.multiTouchCenter = new Point(client.width / 2, client.height / 2);
            }
        }
        this.multiTouchActive = true;
        let opposite: Point | undefined;
        if (this.multiTouchShift && this.multiTouchCenter) {
            const oppoX = 2 * this.multiTouchCenter.x - x;
            const oppoY = 2 * this.multiTouchCenter.y - y;
            if (oppoX <= width && oppoX >= 0 && oppoY <= height && oppoY >= 0) {
                opposite = new Point(oppoX, oppoY);
            }
        } else {
            opposite = new Point(client.width - x, client.height - y);
        }
        if (opposite) {
            result.push({
                action,
                buttons,
                position: new Position(opposite, screenSize),
            });
        }
        return result;
    }

    private static drawCircle(ctx: CanvasRenderingContext2D, point: Point, radius: number): void {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, true);
        ctx.stroke();
    }

    private static drawLine(ctx: CanvasRenderingContext2D, point1: Point, point2: Point): void {
        ctx.beginPath();
        ctx.moveTo(point1.x, point1.y);
        ctx.lineTo(point2.x, point2.y);
        ctx.stroke();
    }

    private static drawPoint(
        ctx: CanvasRenderingContext2D,
        point: Point,
        radius: number,
        image?: HTMLImageElement,
    ): void {
        let { lineWidth } = ctx;
        if (this.pointImagesLoaded && image) {
            radius = image.width / 2;
            lineWidth = 0;
            ctx.drawImage(image, point.x - radius, point.y - radius);
        } else {
            this.drawCircle(ctx, point, radius);
        }

        const topLeft = new Point(point.x - radius - lineWidth, point.y - radius - lineWidth);
        const bottomRight = new Point(point.x + radius + lineWidth, point.y + radius + lineWidth);
        this.updateDirty(topLeft, bottomRight);
    }

    private static updateDirty(topLeft: Point, bottomRight: Point): void {
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

    private static clearCanvas(target: HTMLCanvasElement): void {
        const { clientWidth, clientHeight } = target;
        const ctx = target.getContext('2d');
        if (ctx && this.dirtyPlace.length) {
            const topLeft = this.dirtyPlace[0];
            const bottomRight = this.dirtyPlace[1];
            this.dirtyPlace.length = 0;
            const x = Math.max(topLeft.x, 0);
            const y = Math.max(topLeft.y, 0);
            const w = Math.min(clientWidth, bottomRight.x - x);
            const h = Math.min(clientHeight, bottomRight.y - y);
            ctx.clearRect(x, y, w, h);
        }
    }

    public static formatTouchEvent(
        e: TouchEvent,
        screenInfo: ScreenInfo,
        tag: HTMLElement,
    ): TouchControlEvent[] | null {
        const events: TouchControlEvent[] = [];
        const touches = e.changedTouches;
        if (touches && touches.length) {
            for (let i = 0, l = touches.length; i < l; i++) {
                const touch = touches[i];
                const pointerId = TouchHandler.getPointerId(e.type, touch.identifier);
                if (touch.target !== tag) {
                    continue;
                }
                const item: CommonTouchAndMouse = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    type: e.type,
                    button: 0,
                    target: e.target,
                };
                const event = this.calculateCoordinates(item, screenInfo);
                if (event) {
                    const { action, buttons, position } = event.touch;
                    const pressure = touch.force * 255;
                    events.push(new TouchControlEvent(action, pointerId, position, pressure, buttons));
                } else {
                    console.error(`Failed to format touch`, touch);
                }
            }
        } else {
            console.error('No "touches"', e);
        }
        if (events.length) {
            return events;
        }
        return null;
    }

    public static buildTouchEvent(e: MouseEvent, screenInfo: ScreenInfo): TouchControlEvent[] | null {
        const touches = this.getTouch(e, screenInfo);
        if (!touches) {
            return null;
        }
        const target = e.target as HTMLCanvasElement;
        if (this.multiTouchActive) {
            const ctx = target.getContext('2d');
            if (ctx) {
                this.clearCanvas(target);
                ctx.strokeStyle = TouchHandler.STROKE_STYLE;
                touches.forEach((touch) => {
                    const { point } = touch.position;
                    this.drawPoint(ctx, point, this.touchPointRadius, this.touchPointImage);
                    if (this.multiTouchCenter) {
                        this.drawLine(ctx, this.multiTouchCenter, point);
                    }
                });
                if (this.multiTouchCenter) {
                    this.drawPoint(ctx, this.multiTouchCenter, this.centerPointRadius, this.centerPointImage);
                }
            }
        }
        return touches.map((touch: Touch, pointerId: number) => {
            const { action, buttons, position } = touch;
            return new TouchControlEvent(action, pointerId, position, 255, buttons);
        });
    }
}
