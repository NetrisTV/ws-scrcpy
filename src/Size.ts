export default class Size {
    readonly w: number;
    readonly h: number;

    constructor(readonly width: number, readonly height: number) {
        this.w = width;
        this.h = height;
    }

    public rotate(): Size {
        return new Size(this.height, this.width);
    }

    public equals(o: Size): boolean {
        if (this === o) {
            return true;
        }
        if (o == null) {
            return false;
        }
        return this.width == o.width && this.height == o.height;
    }

    public getHalfSize(): Size {
        return new Size(this.width >>> 1, this.height >>> 1);
    }

    public toString(): string {
        return `Size{width=${this.width}, height=${this.height}}`;
    }
}
