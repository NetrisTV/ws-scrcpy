interface RectInterface {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export default class Rect {
    constructor(readonly left: number, readonly top: number, readonly right: number, readonly bottom: number) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
    }
    public static equals(a?: Rect | null, b?: Rect | null): boolean {
        if (!a && !b) {
            return true;
        }
        return !!a && !!b && a.equals(b);
    }
    public static copy(a?: Rect | null): Rect | null {
        if (!a) {
            return null;
        }
        return new Rect(a.left, a.top, a.right, a.bottom);
    }
    public equals(o: Rect | null): boolean {
        if (this === o) {
            return true;
        }
        if (!o) {
            return false;
        }
        return this.left === o.left && this.top === o.top && this.right === o.right && this.bottom === o.bottom;
    }

    public getWidth(): number {
        return this.right - this.left;
    }

    public getHeight(): number {
        return this.bottom - this.top;
    }

    public toString(): string {
        // prettier-ignore
        return `Rect{left=${
            this.left}, top=${
            this.top}, right=${
            this.right}, bottom=${
            this.bottom}}`;
    }

    public toJSON(): RectInterface {
        return {
            left: this.left,
            right: this.right,
            top: this.top,
            bottom: this.bottom,
        };
    }
}
