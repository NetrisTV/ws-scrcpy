export default class ShaderProgram {
    public program: WebGLProgram | null;
    /**
     * @param {WebGLRenderingContext}gl
     */
    constructor(private gl: WebGLRenderingContext) {
        this.program = this.gl.createProgram();
    }

    /**
     * @param {WebGLShader}shader
     */
    attach(shader: WebGLShader): void {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        this.gl.attachShader(this.program, shader);
    }

    link(): void {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        this.gl.linkProgram(this.program);
        // If creating the shader program failed, alert.
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program.');
        }
    }

    use(): void {
        this.gl.useProgram(this.program);
    }

    /**
     * @param {string}name
     * @return {number}
     */
    getAttributeLocation(name: string): number {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        return this.gl.getAttribLocation(this.program, name);
    }

    /**
     * @param {string}name
     * @return {WebGLUniformLocation | null}
     */
    getUniformLocation(name: string): WebGLUniformLocation | null {
        if (!this.program) {
            throw Error(`Program type is ${typeof this.program}`);
        }
        return this.gl.getUniformLocation(this.program, name);
    }

    /**
     * @param {WebGLUniformLocation}uniformLocation
     * @param {Array<number>}array
     */
    setUniformM4(uniformLocation: WebGLUniformLocation, array: number[]): void {
        this.gl.uniformMatrix4fv(uniformLocation, false, array);
    }
}
