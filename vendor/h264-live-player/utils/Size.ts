/**
 * Represents a 2-dimensional size value.
 */

export default class Size {
    constructor(public w: number, public h: number) {}
    toString() {
        return '(' + this.w + ', ' + this.h + ')';
    }
    getHalfSize() {
        return new Size(this.w >>> 1, this.h >>> 1);
    }
    length() {
        return this.w * this.h;
    }
}
