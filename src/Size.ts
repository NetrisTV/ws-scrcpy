import Rect from "./Rect";

export default class Size {
    constructor(readonly width: number, readonly height: number) {
        this.width = width;
        this.height = height;
    }

    public rotate(): Size {
        return new Size(this.height, this.width);
    }

    public toRect(): Rect {
        return new Rect(0, 0, this.width, this.height);
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

    public toString(): string {
        return `Size{width=${this.width}, height=${this.height}}`;
    }
}
