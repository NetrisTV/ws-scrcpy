# ws scrcpy

Web client prototype for [scrcpy](https://github.com/Genymobile/scrcpy).

## Requirements

You'll need a web browser that supports the following technologies:
* WebSockets
* Media Source Extensions and h264 decoding ([NativeDecoder](/src/decoder/NativeDecoder.ts))
* WebWorkers ([h264bsd](/src/decoder/H264bsdDecoder.ts), [tinyh264](/src/decoder/Tinyh264Decoder.ts))
* WebAssembly  ([Broadway.js](/src/decoder/BroadwayDecoder.ts) and [h264bsd](/src/decoder/H264bsdDecoder.ts), [tinyh264](/src/decoder/Tinyh264Decoder.ts))

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

* The server on the Android Emulator listens on the internal interface and not available from the outside (as workaround you can do `adb forward tcp:8886 tcp:8886` and use `127.0.0.1` instead of emulator IP address)
* H264bsdDecoder may fail to start
* Version `0.3.0` is incompatible with previous. Reboot device or manually kill `app_process`.

## Related projects
* [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy)
* [xevokk/h264-converter](https://github.com/xevokk/h264-converter)
* [131/h264-live-player](https://github.com/131/h264-live-player)
* [oneam/h264bsd](https://github.com/oneam/h264bsd)
* [mbebenita/Broadway](https://github.com/mbebenita/Broadway)
* [openstf/adbkit](https://github.com/openstf/adbkit)
* [openstf/adbkit-logcat](https://github.com/openstf/adbkit-logcat)
* [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)
* [udevbe/tinyh264](https://github.com/udevbe/tinyh264)

## scrcpy websocket fork

Currently, support of WebSocket protocol added to v1.15.1 of scrcpy
* [Prebuilt package](/src/public/scrcpy-server.jar)
* [Source code](https://github.com/NetrisTV/scrcpy/tree/feature/websocket-v1.15.x)
