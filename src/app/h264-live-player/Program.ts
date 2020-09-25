import Shader from './Shader';
import assert from './utils/assert';

export default class Program {
    public readonly program: WebGLProgram | null;

    constructor(readonly gl: WebGLRenderingContext) {
        this.program = this.gl.createProgram();
    }

    public attach(shader: Shader): void {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        if (!shader.shader) {
            throw Error(`Shader type is ${typeof shader.shader}`);
        }
        this.gl.attachShader(this.program, shader.shader);
    }

    public link(): void {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        this.gl.linkProgram(this.program);
        // If creating the shader program failed, alert.
        assert(this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS),
            'Unable to initialize the shader program.');
    }

    public use(): void {
        this.gl.useProgram(this.program);
    }

    public getAttributeLocation(name: string): number {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        return this.gl.getAttribLocation(this.program, name);
    }

    public setMatrixUniform(name: string, array: Float32List): void {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        const uniform = this.gl.getUniformLocation(this.program, name);
        this.gl.uniformMatrix4fv(uniform, false, array);
    }
}
