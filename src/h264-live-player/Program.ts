import Shader from "./Shader";
import error from "./utils/error";
import assert from "./utils/assert";

export default class Program {
    readonly program: WebGLProgram | null;

    constructor(readonly gl: WebGLRenderingContext) {
        this.program = this.gl.createProgram();
    }

    attach(shader: Shader) {
        if (!this.program) {
            error(`Program type is ${typeof this.program}`);
            return;
        }
        if (!shader.shader) {
            error(`Shader type is ${typeof shader.shader}`);
            return;
        }
        this.gl.attachShader(this.program, shader.shader);
    }

    link() {
        if (!this.program) {
            error(`Program type is ${typeof this.program}`);
            return;
        }
        this.gl.linkProgram(this.program);
        // If creating the shader program failed, alert.
        assert(this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS),
            "Unable to initialize the shader program.");
    }

    use() {
        this.gl.useProgram(this.program);
    }

    getAttributeLocation(name: string) {
        if (!this.program) {
            error(`Program type is ${typeof this.program}`);
            return;
        }
        return this.gl.getAttribLocation(this.program, name);
    }

    setMatrixUniform(name: string, array: Float32List) {
        if (!this.program) {
            error(`Program type is ${typeof this.program}`);
            return;
        }
        const uniform = this.gl.getUniformLocation(this.program, name);
        this.gl.uniformMatrix4fv(uniform, false, array);
    }
}
