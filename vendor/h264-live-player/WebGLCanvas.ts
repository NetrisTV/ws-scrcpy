import Size from './utils/Size';
import Texture from './Texture';
import error from './utils/error';
// @ts-ignore
import { Matrix, Vector } from 'sylvester.js';
import Program from './Program';
import Shader from './Shader';
import { makePerspective } from './utils/glUtils';
import Script from './Script';
import Canvas from './Canvas';

export default abstract class WebGLCanvas extends Canvas {
    protected static vertexShaderScript: Script = Script.createFromSource('x-shader/x-vertex', `
      attribute vec3 aVertexPosition;
      attribute vec2 aTextureCoord;
      uniform mat4 uMVMatrix;
      uniform mat4 uPMatrix;
      varying highp vec2 vTextureCoord;
      void main(void) {
        gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
        vTextureCoord = aTextureCoord;
      }
    `);
    protected static fragmentShaderScript: Script = Script.createFromSource('x-shader/x-fragment', `
      precision highp float;
      varying highp vec2 vTextureCoord;
      uniform sampler2D texture;
      void main(void) {
        gl_FragColor = texture2D(texture, vTextureCoord);
      }
    `);
    public quadVPBuffer?: WebGLBuffer | null;
    public quadVTCBuffer?: WebGLBuffer | null;
    public mvMatrix: Matrix;
    public glNames?: Record<string, string>;
    public textureCoordAttribute?: number;
    public vertexPositionAttribute?: number;
    public perspectiveMatrix: Matrix;
    protected gl?: WebGLRenderingContext | null;
    protected framebuffer?: WebGLFramebuffer | null;
    protected framebufferTexture?: Texture;
    protected texture?: Texture;
    protected program?: Program;

    constructor(readonly canvas: HTMLCanvasElement, readonly size: Size, useFrameBuffer: boolean) {
        super(canvas, size);
        this.canvas.width = size.w;
        this.canvas.height = size.h;

        this.onInitWebGL();
        this.onInitShaders();
        this.initBuffers();

        if (useFrameBuffer) {
            this.initFramebuffer();
        }

        this.onInitTextures();
        this.initScene();
    }

    protected initFramebuffer(): void {
        const gl = this.gl;
        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }

        // Create framebuffer object and texture.
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        this.framebufferTexture = new Texture(gl, this.size, gl.RGBA);

        // Create and allocate renderbuffer for depth data.
        const renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.size.w, this.size.h);

        // Attach texture and renderbuffer to the framebuffer.
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.framebufferTexture.texture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
    }

    protected initBuffers(): void {
        let tmp;
        const gl = this.gl;

        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }

        // Create vertex position buffer.
        this.quadVPBuffer = gl.createBuffer();
        if (!this.quadVPBuffer) {
            error(`quadVPBuffer type is ${typeof gl}`);
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVPBuffer);
        tmp = [
            1.0, 1.0, 0.0,
            -1.0, 1.0, 0.0,
            1.0, -1.0, 0.0,
            -1.0, -1.0, 0.0];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tmp), gl.STATIC_DRAW);
        // (this.quadVPBuffer as any).itemSize = 3;
        // (this.quadVPBuffer as any).numItems = 4;

        /*
         +--------------------+
         | -1,1 (1)           | 1,1 (0)
         |                    |
         |                    |
         |                    |
         |                    |
         |                    |
         | -1,-1 (3)          | 1,-1 (2)
         +--------------------+
         */

        const scaleX = 1.0;
        const scaleY = 1.0;

        // Create vertex texture coordinate buffer.
        this.quadVTCBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVTCBuffer);
        tmp = [
            scaleX, 0.0,
            0.0, 0.0,
            scaleX, scaleY,
            0.0, scaleY
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tmp), gl.STATIC_DRAW);
    }

    protected mvIdentity() : void {
        this.mvMatrix = Matrix.I(4);
    }

    protected mvMultiply(m: number): void {
        this.mvMatrix = this.mvMatrix.x(m);
    }

    protected mvTranslate(m: number[]): void {
        const $V = Vector.create;
        this.mvMultiply(Matrix.Translation($V([m[0], m[1], m[2]])).ensure4x4());
    }

    protected setMatrixUniforms(): void {
        if (!this.program) {
            error(`Program type is ${typeof this.program}`);
            return;
        }
        this.program.setMatrixUniform('uPMatrix', new Float32Array(this.perspectiveMatrix.flatten()));
        this.program.setMatrixUniform('uMVMatrix', new Float32Array(this.mvMatrix.flatten()));
    }

    protected initScene(): void {
        const gl = this.gl;

        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }

        // Establish the perspective with which we want to view the
        // scene. Our field of view is 45 degrees, with a width/height
        // ratio of 640:480, and we only want to see objects between 0.1 units
        // and 100 units away from the camera.

        this.perspectiveMatrix = makePerspective(45, 1, 0.1, 100.0);

        // Set the drawing position to the 'identity' point, which is
        // the center of the scene.
        this.mvIdentity();

        // Now move the drawing position a bit to where we want to start
        // drawing the square.
        this.mvTranslate([0.0, 0.0, -2.4]);

        // Draw the cube by binding the array buffer to the cube's vertices
        // array, setting attributes, and pushing it to GL.
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVPBuffer as WebGLBuffer);
        gl.vertexAttribPointer(this.vertexPositionAttribute as number, 3, gl.FLOAT, false, 0, 0);

        // Set the texture coordinates attribute for the vertices.

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVTCBuffer as WebGLBuffer);
        gl.vertexAttribPointer(this.textureCoordAttribute as number, 2, gl.FLOAT, false, 0, 0);

        this.onInitSceneTextures();

        this.setMatrixUniforms();

        if (this.framebuffer) {
            console.log('Bound Frame Buffer');
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        }
    }

    public toString(): string {
        return 'WebGLCanvas Size: ' + this.size;
    }

    protected checkLastError(operation: string): void {
        if (!this.gl || !this.glNames) {
            return;
        }
        const err = this.gl.getError();
        if (err !== this.gl.NO_ERROR) {
            let name = this.glNames[err];
            name = (name !== undefined) ? name + '(' + err + ')' :
                ('Unknown WebGL ENUM (0x' + err.toString(16) + ')');
            if (operation) {
                console.log('WebGL Error: %s, %s', operation, name);
            } else {
                console.log('WebGL Error: %s', name);
            }
            console.trace();
        }
    }

    protected onInitWebGL(): void {
        try {
            this.gl = this.canvas.getContext('experimental-webgl', {
                preserveDrawingBuffer: true
            }) as WebGLRenderingContext;
        } catch (e: any) {
        }

        if (!this.gl) {
            error('Unable to initialize WebGL. Your browser may not support it.');
            return;
        }
        if (this.glNames) {
            return;
        }
        this.glNames = {};
        for (const propertyName in this.gl) {
            if (this.gl.hasOwnProperty(propertyName)) {
                const value = (this.gl as unknown as Record<string, number>)[propertyName];
                if (typeof value === 'number') {
                    this.glNames[value] = propertyName;
                }
            }
        }
    }

    protected onInitShaders(): void {
        const gl = this.gl;
        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }
        this.program = new Program(gl);
        this.program.attach(new Shader(gl, WebGLCanvas.vertexShaderScript));
        this.program.attach(new Shader(gl, WebGLCanvas.fragmentShaderScript));
        this.program.link();
        this.program.use();
        this.vertexPositionAttribute = this.program.getAttributeLocation('aVertexPosition');
        gl.enableVertexAttribArray(this.vertexPositionAttribute as number);
        this.textureCoordAttribute = this.program.getAttributeLocation('aTextureCoord');
        gl.enableVertexAttribArray(this.textureCoordAttribute as number);
    }

    protected onInitTextures(): void {
        const gl = this.gl;
        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }
        this.texture = new Texture(gl, this.size, gl.RGBA);
    }

    protected onInitSceneTextures(): void {
        if (!this.texture) {
            error(`texture type is ${typeof this.texture}`);
            return;
        }
        if (!this.program) {
            error(`program type is ${typeof this.texture}`);
            return;
        }
        this.texture.bind(0, this.program, 'texture');
    }

    protected drawScene(): void {
        const gl = this.gl;
        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    protected readPixels(buffer: Uint8Array): void {
        const gl = this.gl;
        if (!gl) {
            error(`gl type is ${typeof gl}`);
            return;
        }
        gl.readPixels(0, 0, this.size.w, this.size.h, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    }
}
