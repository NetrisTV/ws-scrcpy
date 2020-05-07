# ws scrcpy

Web client prototype for [scrcpy](https://github.com/Genymobile/scrcpy).

## Requirements

You'll need a web browser with these technologies support:
* WebSockets
* Media Source Extensions and h264 decoding ([NativeDecoder](/src/decoder/NativeDecoder.ts))
* WebGL ([Broadway.js](/src/decoder/BroadwayDecoder.ts))
* WebWorkers ([h264bsd](/src/decoder/H264bsdDecoder.ts))
* WebAssembly  (both [Broadway.js](/src/decoder/BroadwayDecoder.ts) and [h264bsd](/src/decoder/H264bsdDecoder.ts))

## Build and Start

```shell
git clone https://github.com/NetrisTV/ws-scrcpy.git
cd ws-scrcpy
npm install
npm start
```

## Supported features
* Screen casting
* Touch events (including multi-touch)
* Input events
* Clipboard events
* Device "rotation"
* Video settings changing

## Known issues

* The server on the Android Emulator listens on internal interface and not available from the outside (as workaround you can do `adb forward tcp:8886 tcp:8886`)
* H264bsdDecoder may fail to start 

## Related projects
* [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy)
* [xevokk/h264-converter](https://github.com/xevokk/h264-converter)
* [131/h264-live-player](https://github.com/131/h264-live-player)
* [oneam/h264bsd](https://github.com/oneam/h264bsd)
* [mbebenita/Broadway](https://github.com/mbebenita/Broadway)
* [openstf/adbkit](https://github.com/openstf/adbkit)
* [openstf/adbkit-logcat](https://github.com/openstf/adbkit-logcat)
* [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)

## scrcpy websocket fork

Currently support of WebSocket protocol added to v1.13 of scrcpy
* [Prebuilt package](https://github.com/NetrisTV/scrcpy/releases/download/v1.13-ws/scrcpy-server.jar)
* [Source code](https://github.com/NetrisTV/scrcpy/tree/feature/websocket-v1.13)
