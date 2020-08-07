import ShaderProgram from './ShaderProgram';
import ShaderCompiler from './ShaderCompiler';
import { fragmentYUV, vertexQuad } from './ShaderSources';
import Texture from '../h264-live-player/Texture';

type ShaderArguments = {
    yTexture: WebGLUniformLocation | null;
    uTexture: WebGLUniformLocation | null;
    vTexture: WebGLUniformLocation | null;
    u_projection: WebGLUniformLocation | null;
    a_position: number;
    a_texCoord: number;
};

export default class YUVSurfaceShader {
    /**
     *
     * @param {WebGLRenderingContext} gl
     * @returns {YUVSurfaceShader}
     */
    static create(gl: WebGLRenderingContext): YUVSurfaceShader {
        const program = this._initShaders(gl);
        const shaderArgs = this._initShaderArgs(gl, program);
        const vertexBuffer = this._initBuffers(gl);

        return new YUVSurfaceShader(gl, vertexBuffer as WebGLBuffer, shaderArgs, program);
    }

    static _initShaders(gl: WebGLRenderingContext): ShaderProgram {
        const program = new ShaderProgram(gl);
        program.attach(ShaderCompiler.compile(gl, vertexQuad) as WebGLShader);
        program.attach(ShaderCompiler.compile(gl, fragmentYUV) as WebGLShader);
        program.link();
        program.use();

        return program;
    }

    static _initShaderArgs(gl: WebGLRenderingContext, program: ShaderProgram): ShaderArguments {
        // find shader arguments
        const shaderArgs: ShaderArguments = {
            yTexture: program.getUniformLocation('yTexture'),
            uTexture: program.getUniformLocation('uTexture'),
            vTexture: program.getUniformLocation('vTexture'),
            u_projection: program.getUniformLocation('u_projection'),
            a_position: program.getAttributeLocation('a_position'),
            a_texCoord: program.getAttributeLocation('a_texCoord'),
        };

        gl.enableVertexAttribArray(shaderArgs.a_position);
        gl.enableVertexAttribArray(shaderArgs.a_texCoord);

        return shaderArgs;
    }

    static _initBuffers(gl: WebGLRenderingContext): WebGLBuffer | null {
        // Create vertex buffer object.
        return gl.createBuffer();
    }

    constructor(
        private gl: WebGLRenderingContext,
        private vertexBuffer: WebGLBuffer,
        private shaderArgs: ShaderArguments,
        private program: ShaderProgram,
    ) {}

    /**
     *
     * @param {Texture} textureY
     * @param {Texture} textureU
     * @param {Texture} textureV
     */
    setTexture(textureY: Texture, textureU: Texture, textureV: Texture): void {
        const gl = this.gl;

        gl.uniform1i(this.shaderArgs.yTexture, 0);
        gl.uniform1i(this.shaderArgs.uTexture, 1);
        gl.uniform1i(this.shaderArgs.vTexture, 2);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureY.texture);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textureU.texture);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, textureV.texture);
    }

    use(): void {
        this.program.use();
    }

    release(): void {
        this.gl.useProgram(null);
    }

    /**
     * @param {{w:number, h:number}}encodedFrameSize
     * @param {{maxXTexCoord:number, maxYTexCoord:number}} h264RenderState
     */
    updateShaderData(
        encodedFrameSize: { w: number; h: number },
        h264RenderState: { maxXTexCoord: number; maxYTexCoord: number },
    ): void {
        const { w, h } = encodedFrameSize;
        this.gl.viewport(0, 0, w, h);
        // prettier-ignore
        this.program.setUniformM4(this.shaderArgs.u_projection as WebGLUniformLocation, [
      2.0 / w, 0, 0, 0,
      0, 2.0 / -h, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1
    ])
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        // prettier-ignore
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            // First triangle
            // top left:
            0, 0, 0, 0,
            // top right:
            w, 0, h264RenderState.maxXTexCoord, 0,
            // bottom right:
            w, h, h264RenderState.maxXTexCoord, h264RenderState.maxYTexCoord,

            // Second triangle
            // bottom right:
            w, h, h264RenderState.maxXTexCoord, h264RenderState.maxYTexCoord,
            // bottom left:
            0, h, 0, h264RenderState.maxYTexCoord,
            // top left:
            0, 0, 0, 0
          ]), this.gl.DYNAMIC_DRAW);
        this.gl.vertexAttribPointer(this.shaderArgs.a_position, 2, this.gl.FLOAT, false, 16, 0);
        this.gl.vertexAttribPointer(this.shaderArgs.a_texCoord, 2, this.gl.FLOAT, false, 16, 8);
    }

    draw(): void {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 6);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
