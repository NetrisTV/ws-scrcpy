var noInput = true;
var decoder = null;

var Module = {
  onRuntimeInitialized: function() {
    decoder = new H264bsdDecoder(Module);
    decoder.onPictureReady = onPictureReady;
    decoder.onHeadersReady = onHeadersReady;
    postMessage({'type': 'decoderReady'});
  }
};

function onMessage(e) {
    var message = e.data;
    switch(message.type) {
    case 'queueInput' :
        decoder.queueInput(message.data);
        if(noInput) {
          noInput = false;
          decodeLoop();
        }
        break;
    }
}

function onPictureReady() {
    var width = decoder.outputPictureWidth();
    var height = decoder.outputPictureHeight();
    var croppingParams = decoder.croppingParams();
    var output = decoder.nextOutputPicture();

    postMessage({
      'type' : 'pictureReady',
      'width' : width,
      'height' : height,
      'croppingParams' : croppingParams,
      'data' : output.buffer,
    }, [output.buffer]);
}

function onHeadersReady() {
    var width = decoder.outputPictureWidth();
    var height = decoder.outputPictureHeight();
    var croppingParams = decoder.croppingParams();

    postMessage({
      'type' : 'pictureParams',
      'width' : width,
      'height' : height,
      'croppingParams' : croppingParams,
    });
}

function decodeLoop() {
    var result = decoder.decode();

    switch(result) {
    case H264bsdDecoder.ERROR:
        postMessage({'type': 'decodeError'});
        break;
    case H264bsdDecoder.PARAM_SET_ERROR:
        postMessage({'type': 'paramSetError'});
        break;
    case H264bsdDecoder.MEMALLOC_ERROR:
        postMessage({'type': 'memAllocError'});
        break;
    case H264bsdDecoder.NO_INPUT:
        noInput = true;
        postMessage({'type': 'noInput'});
        break;
    default:
        setTimeout(decodeLoop, 0);
    }
}

addEventListener('message', onMessage);
importScripts('h264bsd_decoder.js', 'h264bsd_wasm.js')
