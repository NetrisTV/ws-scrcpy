const wsUrl = 'ws://172.17.1.68:8886/';
const VideoConverter = require('h264-converter').default;
const CONST = require('./const');
const DEFAULT_FPF = 6;

const Start = function() {
  const element = document.getElementById('videoTagId');
  let converter;

  const websocket = new WebSocket(wsUrl);
  websocket.binaryType = 'arraybuffer';

  websocket.addEventListener('message', function(e) {
    if (typeof e.data !== 'string' && converter) {
      converter.appendRawData(new Uint8Array(e.data));
    } else {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (e) {
        console.log(e.data);
        return;
      }
      switch (data.type) {
      case CONST.MESSAGE_TYPE_STREAM_INFO:
        if (converter) {
          converter.appendRawData(new Uint8Array([]));
          converter.pause();
        }
        converter = new VideoConverter(element, data.frameRate, DEFAULT_FPF);
        converter.play();
        break;
      case CONST.MESSAGE_TYPE_TEXT:
        console.log(data.message);
        break;
      default:
        console.log(e.data);
      }
    }
  }, false);
  const btn = document.getElementById('start');
  btn.innerText = 'Stop';
  btn.onclick = function() {
    websocket.close();
    converter.pause();
    btn.innerText = 'Start';
    btn.onclick = Start;
  }
};

window.onload = function() {
  const btn = document.getElementById('start');
  btn.onclick = Start;
};
