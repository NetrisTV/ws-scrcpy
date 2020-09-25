import Script from './Script';
import error from './utils/error';

export default class Shader {
    public readonly shader?: WebGLShader | null;

    constructor(readonly gl: WebGLRenderingContext, readonly script: Script) {
        // Now figure out what type of shader script we have, based on its MIME type.
        if (script.type === 'x-shader/x-fragment') {
            this.shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (script.type === 'x-shader/x-vertex') {
            this.shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            error(`Unknown shader type: ${script.type}`);
            return;
        }

        if (!this.shader) {
            error(`Shader is ${typeof this.shader}`);
            return;
        }

        // Send the source to the shader object.
        gl.shaderSource(this.shader, script.source);

        // Compile the shader program.
        gl.compileShader(this.shader);

        // See if it compiled successfully.
        if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
            error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(this.shader));
            return;
        }
    }
}
