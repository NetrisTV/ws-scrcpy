export default class Point {
    constructor(readonly x: number, readonly y: number) {
        this.x = Math.round(x);
        this.y = Math.round(y);
    }

    public equals(o: Point): boolean {
        if (this === o) {
            return true;
        }
        if (o == null) {
            return false;
        }
        return this.x === o.x && this.y === o.y;
    }

    public toString(): string {
        return `Point{x=${this.x}, y=${this.y}}`;
    }
}
