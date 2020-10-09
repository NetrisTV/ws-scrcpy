export interface PointInterface {
    x: number;
    y: number;
}

export default class Point {
    readonly x: number;
    readonly y: number;
    constructor(x: number, y: number) {
        this.x = Math.round(x);
        this.y = Math.round(y);
    }

    public equals(o: Point): boolean {
        if (this === o) {
            return true;
        }
        if (o === null) {
            return false;
        }
        return this.x === o.x && this.y === o.y;
    }

    public distance(to: Point): number {
        const x = this.x - to.x;
        const y = this.y - to.y;
        return Math.sqrt(x * x + y * y);
    }

    public toString(): string {
        return `Point{x=${this.x}, y=${this.y}}`;
    }

    public toJSON(): PointInterface {
        return {
            x: this.x,
            y: this.y,
        };
    }
}
