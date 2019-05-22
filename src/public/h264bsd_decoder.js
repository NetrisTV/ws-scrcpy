//
//  Copyright (c) 2013 Sam Leitch. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to
//  deal in the Software without restriction, including without limitation the
//  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
//  sell copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
//  IN THE SOFTWARE.
//

/**
 * This class wraps the details of the h264bsd library.
 * Module object is an Emscripten module provided globally by h264bsd_asm.js
 *
 * In order to use this class, you first queue encoded data using queueData.
 * Each call to decode() will decode a single encoded element.
 * When decode() returns H264bsdDecoder.PIC_RDY, a picture is ready in the output buffer.
 * You can also use the onPictureReady() function to determine when a picture is ready.
 * The output buffer can be accessed by calling getNextOutputPicture()
 * An output picture may also be decoded using an H264bsdCanvas.
 * When you're done decoding, make sure to call release() to clean up internal buffers.
 */

function H264bsdDecoder(module) {
    this.module = module;
    this.released = false;

    this.pInput = 0;
    this.inputLength = 0;
    this.inputOffset = 0;

    this.onPictureReady = null;
    this.onHeadersReady = null;

    this.pBytesRead = module._malloc(4);
    this.pPicId = module._malloc(4);
    this.pIsIdrPic = module._malloc(4);
    this.pNumErrMbs = module._malloc(4);
    this.pCroppingFlag = module._malloc(4);
    this.pLeftOffset = module._malloc(4);
    this.pWidth = module._malloc(4);
    this.pTopOffset = module._malloc(4);
    this.pHeight = module._malloc(4);

    this.pStorage = module._h264bsdAlloc();
    module._h264bsdInit(this.pStorage, 0);
};

H264bsdDecoder.RDY = 0;
H264bsdDecoder.PIC_RDY = 1;
H264bsdDecoder.HDRS_RDY = 2;
H264bsdDecoder.ERROR = 3;
H264bsdDecoder.PARAM_SET_ERROR = 4;
H264bsdDecoder.MEMALLOC_ERROR = 5;
H264bsdDecoder.NO_INPUT = 1024;

/**
 * Clean up memory used by the decoder
 */
H264bsdDecoder.prototype.release = function() {
    var module = this.module;
    var pStorage = this.pStorage;
    var pInput = this.pInput;
    var pPicId = this.pPicId;
    var pIsIdrPic = this.pIsIdrPic;
    var pNumErrMbs = this.pNumErrMbs;
    var pBytesRead = this.pBytesRead;
    var pCroppingFlag = this.pCroppingFlag;
    var pLeftOffset = this.pLeftOffset;
    var pWidth = this.pWidth;
    var pTopOffset = this.pTopOffset;
    var pHeight = this.pHeight;

    if(pStorage != 0) {
        module._h264bsdShutdown(pStorage);
        module._h264bsdFree(pStorage);
    }

    if(pInput != 0) {
        module._free(pInput);
    }

    module._free(pPicId);
    module._free(pIsIdrPic);
    module._free(pNumErrMbs);
    module._free(pBytesRead);
    module._free(pCroppingFlag);
    module._free(pLeftOffset);
    module._free(pWidth);
    module._free(pTopOffset);
    module._free(pHeight);

    this.pStorage = 0;
    this.pInput = 0;
    this.inputLength = 0;
    this.inputOffset = 0;

    this.pPicId = 0;
    this.pIsIdrPic = 0;
    this.pNumErrMbs = 0;
    this.pBytesRead = 0;
    this.pCroppingFlag = 0;
    this.pLeftOffset = 0;
    this.pWidth = 0;
    this.pTopOffset = 0;
    this.pHeight = 0;
};

/**
 * Queue ArrayBuffer data to be decoded
 */
H264bsdDecoder.prototype.queueInput = function(data) {
    var module = this.module
    var pInput = this.pInput;
    var inputLength = this.inputLength;
    var inputOffset = this.inputOffset;

    if (data instanceof ArrayBuffer) {
        data = new Uint8Array(data)
    }

    if(pInput === 0) {
        inputLength = data.byteLength;
        pInput = module._malloc(inputLength);
        inputOffset = 0;

        module.HEAPU8.set(data, pInput);
    } else {
        var remainingInputLength = inputLength - inputOffset;
        var newInputLength = remainingInputLength + data.byteLength;
        var pNewInput = module._malloc(newInputLength);

        module._memcpy(pNewInput, pInput + inputOffset, remainingInputLength);
        module.HEAPU8.set(data, pNewInput + remainingInputLength);

        module._free(pInput);

        pInput = pNewInput;
        inputLength = newInputLength;
        inputOffset = 0;
    }

    this.pInput = pInput;
    this.inputLength = inputLength;
    this.inputOffset = inputOffset;
}

/**
 * Returns the numbre of bytes remaining in the decode queue.
 */
H264bsdDecoder.prototype.inputBytesRemaining = function() {
    return this.inputLength - this.inputOffset;
};

/**
 * Decodes the next NAL unit from the queued data.
 * Returns H264bsdDecoder.PIC_RDY when a new picture is ready.
 * Pictures can be accessed using nextOutputPicture() or nextOutputPictureRGBA()
 * decode() will return H264bsdDecoder.NO_INPUT when there is no more data to be decoded.
 */
H264bsdDecoder.prototype.decode = function() {
    var module = this.module;
    var pStorage = this.pStorage;
    var pInput = this.pInput;
    var pBytesRead = this.pBytesRead;
    var inputLength = this.inputLength;
    var inputOffset = this.inputOffset;

    if(pInput == 0) return H264bsdDecoder.NO_INPUT;

    var bytesRead = 0;
    var retCode = module._h264bsdDecode(pStorage, pInput + inputOffset, inputLength - inputOffset, 0, pBytesRead);

    if (retCode == H264bsdDecoder.RDY ||
        retCode == H264bsdDecoder.PIC_RDY ||
        retCode == H264bsdDecoder.HDRS_RDY) {
        bytesRead = module.getValue(pBytesRead, 'i32');
    }

    inputOffset += bytesRead;

    if(inputOffset >= inputLength) {
        module._free(pInput);
        pInput = 0;
        inputOffset = 0;
        inputLength = 0;
    }

    this.pInput = pInput;
    this.inputLength = inputLength;
    this.inputOffset = inputOffset;

    if(retCode == H264bsdDecoder.PIC_RDY && this.onPictureReady instanceof Function) {
        this.onPictureReady();
    }

    if(retCode == H264bsdDecoder.HDRS_RDY && this.onHeadersReady instanceof Function) {
        this.onHeadersReady();
    }

    return retCode;
};

/**
 * Returns the next output picture as an I420 encoded image.
 */
H264bsdDecoder.prototype.nextOutputPicture = function() {
    var module = this.module;
    var pStorage = this.pStorage;
    var pPicId = this.pPicId;
    var pIsIdrPic = this.pIsIdrPic;
    var pNumErrMbs = this.pNumErrMbs;

    var pBytes = module._h264bsdNextOutputPicture(pStorage, pPicId, pIsIdrPic, pNumErrMbs);

    var outputLength = this.outputPictureSizeBytes();
    var outputBytes = new Uint8Array(module.HEAPU8.subarray(pBytes, pBytes + outputLength));

    return outputBytes;
};

/**
 * Returns the next output picture as an RGBA encoded image.
 * Note: There is extra overhead required to convert the image to RGBA.
 * This method should be avoided if possible.
 */
H264bsdDecoder.prototype.nextOutputPictureRGBA = function() {
    var module = this.module;
    var pStorage = this.pStorage;
    var pPicId = this.pPicId;
    var pIsIdrPic = this.pIsIdrPic;
    var pNumErrMbs = this.pNumErrMbs;

    var pBytes = module._h264bsdNextOutputPictureRGBA(pStorage, pPicId, pIsIdrPic, pNumErrMbs);

    var outputLength = this.outputPictureSizeBytesRGBA();
    var outputBytes = new Uint8Array(module.HEAPU8.subarray(pBytes, pBytes + outputLength));

    return outputBytes;
};

/**
 * Returns an object containing the width and height of output pictures in pixels.
 * This value is only valid after at least one call to decode() has returned H264bsdDecoder.HDRS_RDY
 * You can also use onHeadersReady callback to determine when this value changes.
 */
H264bsdDecoder.prototype.outputPictureWidth = function() {
    var module = this.module;
    var pStorage = this.pStorage;

    return module._h264bsdPicWidth(pStorage) * 16;
};

/**
 * Returns an object containing the width and height of output pictures in pixels.
 * This value is only valid after at least one call to decode() has returned H264bsdDecoder.HDRS_RDY
 * You can also use onHeadersReady callback to determine when this value changes.
 */
H264bsdDecoder.prototype.outputPictureHeight = function() {
    var module = this.module;
    var pStorage = this.pStorage;

    return module._h264bsdPicHeight(pStorage) * 16;
};

/**
 * Returns integer byte length of output pictures in bytes.
 * This value is only valid after at least one call to decode() has returned H264bsdDecoder.HDRS_RDY
 */
H264bsdDecoder.prototype.outputPictureSizeBytes = function() {
    var width = this.outputPictureWidth();
    var height = this.outputPictureHeight();

    return (width * height) * 3 / 2;
};

/**
 * Returns integer byte length of RGBA output pictures in bytes.
 * This value is only valid after at least one call to decode() has returned H264bsdDecoder.HDRS_RDY
 */
H264bsdDecoder.prototype.outputPictureSizeBytesRGBA = function() {
    var width = this.outputPictureWidth();
    var height = this.outputPictureHeight();

    return (width * height) * 4;
};

/**
 * Returns the info used to crop output images to there final viewing dimensions.
 * If this method returns null no cropping info is provided and the full image should be presented.
 */
H264bsdDecoder.prototype.croppingParams = function() {
    var module = this.module;
    var pStorage = this.pStorage;
    var pCroppingFlag = this.pCroppingFlag;
    var pLeftOffset = this.pLeftOffset;
    var pWidth = this.pWidth;
    var pTopOffset = this.pTopOffset;
    var pHeight = this.pHeight;

    module._h264bsdCroppingParams(pStorage, pCroppingFlag, pLeftOffset, pWidth, pTopOffset, pHeight);

    var croppingFlag = module.getValue(pCroppingFlag, 'i32');
    var leftOffset = module.getValue(pLeftOffset, 'i32');
    var width = module.getValue(pWidth, 'i32');
    var topOffset = module.getValue(pTopOffset, 'i32');
    var height = module.getValue(pHeight, 'i32');

    if(croppingFlag === 0) return null;

    return {
        'width': width,
        'height': height,
        'top': topOffset,
        'left': leftOffset
    };
};

if (typeof module !== "undefined") {
    module.exports = H264bsdDecoder;
}
