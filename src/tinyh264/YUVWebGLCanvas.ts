/**
 * based on tinyh264 demo: https://github.com/udevbe/tinyh264/tree/master/demo
 */

import YUVSurfaceShader from './YUVSurfaceShader';
import Texture from '../h264-live-player/Texture';
import Canvas from './Canvas';

export default class YUVWebGLCanvas extends Canvas {
    private yTexture: Texture;
    private uTexture: Texture;
    private vTexture: Texture;
    private yuvSurfaceShader: YUVSurfaceShader;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        const gl = canvas.getContext('experimental-webgl', {
            preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null;
        if (!gl) {
            throw new Error('Unable to initialize WebGL. Your browser may not support it.');
        }
        this.yuvSurfaceShader = YUVSurfaceShader.create(gl);
        this.yTexture = Texture.create(gl, gl.LUMINANCE);
        this.uTexture = Texture.create(gl, gl.LUMINANCE);
        this.vTexture = Texture.create(gl, gl.LUMINANCE);
    }

    decode(buffer: Uint8Array, width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;

        // the width & height returned are actually padded, so we have to use the frame size to get the real image dimension
        // when uploading to texture
        const stride = width; // stride
        // height is padded with filler rows

        // if we knew the size of the video before encoding, we could cut out the black filler pixels. We don't, so just set
        // it to the size after encoding
        const sourceWidth = width;
        const sourceHeight = height;
        const maxXTexCoord = sourceWidth / stride;
        const maxYTexCoord = sourceHeight / height;

        const lumaSize = stride * height;
        const chromaSize = lumaSize >> 2;

        const yBuffer = buffer.subarray(0, lumaSize);
        const uBuffer = buffer.subarray(lumaSize, lumaSize + chromaSize);
        const vBuffer = buffer.subarray(lumaSize + chromaSize, lumaSize + 2 * chromaSize);

        const chromaHeight = height >> 1;
        const chromaStride = stride >> 1;

        // we upload the entire image, including stride padding & filler rows. The actual visible image will be mapped
        // from texture coordinates as to crop out stride padding & filler rows using maxXTexCoord and maxYTexCoord.

        this.yTexture.image2dBuffer(yBuffer, stride, height);
        this.uTexture.image2dBuffer(uBuffer, chromaStride, chromaHeight);
        this.vTexture.image2dBuffer(vBuffer, chromaStride, chromaHeight);

        this.yuvSurfaceShader.setTexture(this.yTexture, this.uTexture, this.vTexture);
        this.yuvSurfaceShader.updateShaderData({ w: width, h: height }, { maxXTexCoord, maxYTexCoord });
        this.yuvSurfaceShader.draw();
    }
}
