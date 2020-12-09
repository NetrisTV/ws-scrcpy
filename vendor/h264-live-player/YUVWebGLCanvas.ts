import WebGLCanvas from './WebGLCanvas';
import Size from './utils/Size';
import Program from './Program';
import Shader from './Shader';
import Script from './Script';
import Texture from './Texture';

export default class YUVWebGLCanvas extends WebGLCanvas {
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
      uniform sampler2D YTexture;
      uniform sampler2D UTexture;
      uniform sampler2D VTexture;
      const mat4 YUV2RGB = mat4
      (
       1.1643828125, 0, 1.59602734375, -.87078515625,
       1.1643828125, -.39176171875, -.81296875, .52959375,
       1.1643828125, 2.017234375, 0, -1.081390625,
       0, 0, 0, 1
      );

      void main(void) {
       gl_FragColor = vec4(
         texture2D(YTexture,  vTextureCoord).x,
         texture2D(UTexture, vTextureCoord).x,
         texture2D(VTexture, vTextureCoord).x,
         1
       ) * YUV2RGB;
      }`);

    private YTexture?: Texture;
    private UTexture?: Texture;
    private VTexture?: Texture;

    constructor(readonly canvas: HTMLCanvasElement, readonly size: Size) {
        super(canvas, size, false);
    }

    protected onInitShaders(): void {
        if (!this.gl) {
            return;
        }
        this.program = new Program(this.gl);
        this.program.attach(new Shader(this.gl, YUVWebGLCanvas.vertexShaderScript));
        this.program.attach(new Shader(this.gl, YUVWebGLCanvas.fragmentShaderScript));
        this.program.link();
        this.program.use();
        this.vertexPositionAttribute = this.program.getAttributeLocation('aVertexPosition');
        this.gl.enableVertexAttribArray(this.vertexPositionAttribute as number);
        this.textureCoordAttribute = this.program.getAttributeLocation('aTextureCoord');
        this.gl.enableVertexAttribArray(this.textureCoordAttribute as number);
    }

    protected onInitTextures(): void {
        if (!this.gl) {
            return;
        }
        this.YTexture = new Texture(this.gl, this.size);
        this.UTexture = new Texture(this.gl, this.size.getHalfSize());
        this.VTexture = new Texture(this.gl, this.size.getHalfSize());
    }

    protected onInitSceneTextures(): void {
        if (!this.program) {
            return;
        }
        if (!this.YTexture || !this.UTexture || !this.VTexture) {
            return;
        }
        this.YTexture.bind(0, this.program, 'YTexture');
        this.UTexture.bind(1, this.program, 'UTexture');
        this.VTexture.bind(2, this.program, 'VTexture');
    }

    protected fillYUVTextures(y: Uint8Array, u: Uint8Array, v: Uint8Array): void {
        if (!this.YTexture || !this.UTexture || !this.VTexture) {
            return;
        }
        this.YTexture.fill(y);
        this.UTexture.fill(u);
        this.VTexture.fill(v);
    }

    public decode(buffer: Uint8Array, width: number, height: number): void {

        if (!buffer) {
            return;
        }
        if (!this.YTexture || !this.UTexture || !this.VTexture) {
            return;
        }

        const lumaSize = width * height;
        const chromaSize = lumaSize >> 2;
        this.fillYUVTextures(
            buffer.subarray(0, lumaSize),
            buffer.subarray(lumaSize, lumaSize + chromaSize),
            buffer.subarray(lumaSize + chromaSize, lumaSize + 2 * chromaSize)
        );

        this.drawScene();
    }

    public toString(): string {
        return 'YUVCanvas Size: ' + this.size;
    }
}
