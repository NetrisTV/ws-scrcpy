const wsUrl = 'ws://172.17.1.68:8886/';
const VideoConverter = require('h264-converter').default;
const CONST = require('./const');
const DEFAULT_FPF = 6;

const Start = function() {
  const element = document.getElementById('videoTagId');
  let converter;
  let streamInfo;

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
        streamInfo = data;
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

  const inputWrapperId = 'inputWrap';
  const controlsWrapperId = 'controlsWrap';
  const btn = document.getElementById('start');
  btn.innerText = 'Stop';
  btn.onclick = function() {
    websocket.close();
    converter.pause();
    btn.innerText = 'Start';
    btn.onclick = Start;
    const textWrap = document.getElementById(inputWrapperId);
    if (textWrap) {
      textWrap.parentElement.removeChild(textWrap);
    }
  };

  const textWrap = document.createElement('div');
  textWrap.id = inputWrapperId;
  const input = document.createElement('input');
  const sendButton = document.createElement('button');
  sendButton.innerText = 'Send';
  textWrap.appendChild(input);
  textWrap.appendChild(sendButton);
  document.getElementById(controlsWrapperId).appendChild(textWrap);
  sendButton.onclick = function() {
    if (websocket && websocket.readyState === websocket.OPEN) {
      const type = CONST.MESSAGE_TYPE_EVENT;
      const text = input.value;
      const eventType = CONST.EVENT_TYPE.TEXT;
      websocket.send(JSON.stringify({type: type, text: text, eventType: eventType}));
    }
  };

  document.body.oncontextmenu = function(e) {
    e.preventDefault();
    return false;
  };

  let down = 0;

  function onMouseEvent(e) {
    if (e.target === element && websocket && websocket.readyState === websocket.OPEN) {
      const event = buildMotionEvent(e);
      if (event) {
        websocket.send(JSON.stringify(event));
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  const EVENT_ACTION_MAP = {
    'mousedown': CONST.MOTION_EVENT.ACTION_DOWN,
    'mousemove': CONST.MOTION_EVENT.ACTION_MOVE,
    'mouseup': CONST.MOTION_EVENT.ACTION_UP
  };

  const BUTTONS_MAP = {
    0: 17, // ?? BUTTON_PRIMARY
    1: CONST.MOTION_EVENT.BUTTON_TERTIARY,
    2: 26  // ?? BUTTON_SECONDARY
  };

  function buildMotionEvent(e) {
    const action = EVENT_ACTION_MAP[e.type];
    if (typeof action === 'undefined') {
      return null;
    }
    let {clientWidth, clientHeight} = element;
    const width = streamInfo.width;
    const height = streamInfo.height;
    let touchX = (e.clientX - e.target.offsetLeft);
    let touchY = (e.clientY - e.target.offsetTop);
    const eps = 1e5;
    const ratio = width / height;
    if (Math.round(eps * ratio) > Math.round(eps * clientWidth / clientHeight)) {
      const realHeight = Math.ceil(clientWidth / ratio);
      const top = (clientHeight - realHeight) / 2;
      if (touchY < top || touchY > top + realHeight) {
        return null;
      }
      touchY -= top;
      clientHeight = realHeight;
    }
    const x = touchX * width / clientWidth;
    const y = touchY * height / clientHeight;

    const type = CONST.MESSAGE_TYPE_EVENT;
    const eventType = CONST.EVENT_TYPE.MOUSE;
    return {
      type: type,
      eventType: eventType,
      position: {
        x: x,
        y: y,
        width: width,
        height: height
      },
      buttons: BUTTONS_MAP[e.button],
      action: action
    };
  }

  document.body.onmousedown = function(e) {
    down++;
    onMouseEvent(e);
  };
  document.body.onmouseup = function(e) {
    down--;
    onMouseEvent(e);
  };
  document.body.onmousemove = function(e) {
    if (down > 0) {
      onMouseEvent(e);
    }
  };
};


window.onload = function() {
  const btn = document.getElementById('start');
  btn.onclick = Start;
};
