import Point from './Point';
import Size from './Size';

export default class Position {
    public constructor(readonly point: Point, readonly screenSize: Size) {
        this.point = point;
        this.screenSize = screenSize;
    }

    public equals(o: Position): boolean {
        if (this === o) {
            return true;
        }
        if (o === null) {
            return false;
        }

        return this.point.equals(o.point) && this.screenSize.equals(o.screenSize);
    }

    public toString(): string {
        return `Position{point=${this.point}, screenSize=${this.screenSize}}`;
    }
}
