import Point, { PointInterface } from './Point';
import Size, { SizeInterface } from './Size';

export interface PositionInterface {
    point: PointInterface;
    screenSize: SizeInterface;
}

export default class Position {
    public constructor(readonly point: Point, readonly screenSize: Size) {}

    public equals(o: Position): boolean {
        if (this === o) {
            return true;
        }
        if (o === null) {
            return false;
        }

        return this.point.equals(o.point) && this.screenSize.equals(o.screenSize);
    }

    public rotate(rotation: number): Position {
        switch (rotation) {
            case 1:
                return new Position(
                    new Point(this.screenSize.height - this.point.y, this.point.x),
                    this.screenSize.rotate(),
                );
            case 2:
                return new Position(
                    new Point(this.screenSize.width - this.point.x, this.screenSize.height - this.point.y),
                    this.screenSize,
                );
            case 3:
                return new Position(
                    new Point(this.point.y, this.screenSize.width - this.point.x),
                    this.screenSize.rotate(),
                );
            default:
                return this;
        }
    }

    public toString(): string {
        return `Position{point=${this.point}, screenSize=${this.screenSize}}`;
    }

    public toJSON(): PositionInterface {
        return {
            point: this.point.toJSON(),
            screenSize: this.screenSize.toJSON(),
        };
    }
}
