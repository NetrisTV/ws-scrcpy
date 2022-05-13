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
git clone https://github.com/drauggres/ws-scrcpy.git
cd ws-scrcpy
npm install
npm start
```

## Supported features
* Screen casting
* Touch events
* Input events
* Video setting changing

## Known issues

* The server on the Android Emulator listens on internal interface and not available from the outside (as workaround you can do `adb forward tcp:8886 tcp:8886`)

## scrcpy websocket fork

Currently support of WebSocket protocol added to v1.8 of scrcpy
* [Prebuilt package](https://github.com/drauggres/scrcpy/releases/download/v1.8.1/scrcpy-server.jar)
* [Source code](https://github.com/drauggres/scrcpy/tree/feature/websocket-server)
