import Size from './utils/Size';
import assert from './utils/assert';
import Program from './Program';

export default class Texture {
    public readonly texture: WebGLTexture | null;
    public readonly format: GLenum;
    private textureIDs: number[];

    static create (gl: WebGLRenderingContext, format: number): Texture {
        return new Texture(gl, undefined, format);
    }

    constructor(readonly gl: WebGLRenderingContext, readonly size?: Size, format?: GLenum) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        this.format = format ? format : gl.LUMINANCE;
        if (size) {
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format, size.w, size.h, 0, this.format, gl.UNSIGNED_BYTE, null);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.textureIDs = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2];
    }

    public fill(textureData: Uint8Array, useTexSubImage2D?: boolean, w?: number, h?: number): void {
        if (typeof w === 'undefined' || typeof h === 'undefined') {
            if (!this.size) {
                return;
            }
            w = this.size.w;
            h = this.size.h;
        }
        const gl = this.gl;
        assert(textureData.length >= w * h,
            'Texture size mismatch, data:' + textureData.length + ', texture: ' + w * h);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (useTexSubImage2D) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, this.format, gl.UNSIGNED_BYTE, textureData);
        } else {
            // texImage2D seems to be faster, thus keeping it as the default
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format, w, h, 0, this.format, gl.UNSIGNED_BYTE, textureData);
        }
    }

    public image2dBuffer (buffer: Uint8Array, width: number, height: number) {
        this.fill(buffer, false, width, height);
    }

    public bind(n: number, program: Program, name: string): void {
        const gl = this.gl;
        if (!program.program) {
            return;
        }
        gl.activeTexture(this.textureIDs[n]);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(gl.getUniformLocation(program.program, name), n);
    }
}
