// @ts-ignore
import { Matrix, Vector } from 'sylvester.js';

const $M = Matrix.create;

// augment Sylvester some
Matrix.Translation = function(v: Matrix): Matrix {
    if (v.elements.length === 2) {
        const r = Matrix.I(3);
        r.elements[2][0] = v.elements[0];
        r.elements[2][1] = v.elements[1];
        return r;
    }

    if (v.elements.length === 3) {
        const r = Matrix.I(4);
        r.elements[0][3] = v.elements[0];
        r.elements[1][3] = v.elements[1];
        r.elements[2][3] = v.elements[2];
        return r;
    }

    throw Error('Invalid length for Translation');
};

Matrix.prototype.flatten = function(): number[] {
    const result = [];
    /* tslint:disable: no-invalid-this prefer-for-of */
    if (this.elements.length === 0) {
        return [];
    }

    for (let j = 0; j < this.elements[0].length; j++) {
        for (let i = 0; i < this.elements.length; i++) {
            result.push(this.elements[i][j]);
        }
    }
    /* tslint:enable */
    return result;
};

Matrix.prototype.ensure4x4 = function(): Matrix | null {
    /* tslint:disable: no-invalid-this */
    if (this.elements.length === 4 && this.elements[0].length === 4) {
        return this;
    }

    if (this.elements.length > 4 || this.elements[0].length > 4) {
        return null;
    }

    for (let i = 0; i < this.elements.length; i++) {
        for (let j = this.elements[i].length; j < 4; j++) {
            if (i === j) {
                this.elements[i].push(1);
            } else {
                this.elements[i].push(0);
            }
        }
    }

    for (let i = this.elements.length; i < 4; i++) {
        if (i === 0) {
            this.elements.push([1, 0, 0, 0]);
        } else if (i === 1) {
            this.elements.push([0, 1, 0, 0]);
        } else if (i === 2) {
            this.elements.push([0, 0, 1, 0]);
        } else if (i === 3) {
            this.elements.push([0, 0, 0, 1]);
        }
    }

    return this;
    /* tslint:enable */
};

Vector.prototype.flatten = function(): number[] {
    /* tslint:disable: no-invalid-this */
    return this.elements;
    /* tslint:enable */
};

//
// gluPerspective
//
export function makePerspective(fovy: number, aspect: number, znear: number, zfar: number): Matrix {
    const ymax = znear * Math.tan(fovy * Math.PI / 360.0);
    const ymin = -ymax;
    const xmin = ymin * aspect;
    const xmax = ymax * aspect;

    return makeFrustum(xmin, xmax, ymin, ymax, znear, zfar);
}

//
// glFrustum
//
function makeFrustum(left: number, right: number,
                     bottom: number, top: number,
                     znear: number, zfar: number): Matrix {
    const X = 2 * znear / (right - left);
    const Y = 2 * znear / (top - bottom);
    const A = (right + left) / (right - left);
    const B = (top + bottom) / (top - bottom);
    const C = -(zfar + znear) / (zfar - znear);
    const D = -2 * zfar * znear / (zfar - znear);

    return $M([[X, 0, A, 0],
        [0, Y, B, 0],
        [0, 0, C, D],
        [0, 0, -1, 0]]);
}
