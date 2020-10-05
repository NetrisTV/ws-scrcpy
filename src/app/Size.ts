export interface SizeInterface {
    width: number;
    height: number;
}

export default class Size {
    public readonly w: number;
    public readonly h: number;

    constructor(readonly width: number, readonly height: number) {
        this.w = width;
        this.h = height;
    }

    public static equals(a?: Size | null, b?: Size | null): boolean {
        if (!a && !b) {
            return true;
        }
        return !!a && !!b && a.equals(b);
    }

    public static copy(a?: Size | null): Size | null {
        if (!a) {
            return null;
        }
        return new Size(a.width, a.height);
    }

    public rotate(): Size {
        return new Size(this.height, this.width);
    }

    public equals(o: Size | null): boolean {
        if (this === o) {
            return true;
        }
        if (!o) {
            return false;
        }
        return this.width === o.width && this.height === o.height;
    }

    public getHalfSize(): Size {
        return new Size(this.width >>> 1, this.height >>> 1);
    }

    public toString(): string {
        return `Size{width=${this.width}, height=${this.height}}`;
    }

    public toJSON(): SizeInterface {
        return {
            width: this.width,
            height: this.height,
        };
    }
}
