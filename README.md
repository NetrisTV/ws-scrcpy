# ws scrcpy

Web client prototype for [scrcpy](https://github.com/Genymobile/scrcpy).

## Requirements

You'll need a web browser that supports the following technologies:
* WebSockets
* Media Source Extensions and h264 decoding ([MseDecoder](/src/decoder/MseDecoder.ts))
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

### Screen casting
The modified [version](https://github.com/NetrisTV/scrcpy/tree/feature/websocket-v1.16.x) of [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy) used to stream H264 video, which then decoded by one of included decoders.

### Remote control
* Touch events (including multi-touch)
* Multi-touch emulation: <kbd>CTRL</kbd> to start with center at the center of the screen, <kbd>SHIFT</kbd> + <kbd>CTRL</kbd> to start with center at the current point
* Capturing keyboard events
* Injecting text (ASCII only)
* Copy to/from device clipboard
* Device "rotation"

### File push
Drag & drop an APK file to push it to the `/data/local/tmp` directory. You can install it manually from the included [xterm.js](https://github.com/xtermjs/xterm.js) terminal emulator.

## Known issues

* New versions are most likely not incompatible with previous ones. If you do upgrade, then manually stop `app_process` or just reboot the device.
* The server on the Android Emulator listens on the internal interface and not available from the outside (as workaround you can do `adb forward tcp:8886 tcp:8886` and use `127.0.0.1` instead of emulator IP address)
* H264bsdDecoder and Tinyh264Decoder may fail to start, try to reload the page.
* MseDecoder reports too many dropped frames in quality statistics: needs further investigation.

## Security warning
Be advised and keep in mind:
* There is no encryption between browser and node.js server (plain HTTP).
* There is no encryption between browser and WebSocket server (plain WS).
* There is no authorization on any level.
* The modified version of scrcpy with integrated WebSocket server is listening for connections on all network interfaces.
* The modified version of scrcpy will keep running after the last client disconnected.

## Related projects
* [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy)
* [xevokk/h264-converter](https://github.com/xevokk/h264-converter)
* [131/h264-live-player](https://github.com/131/h264-live-player)
* [oneam/h264bsd](https://github.com/oneam/h264bsd)
* [mbebenita/Broadway](https://github.com/mbebenita/Broadway)
* [openstf/adbkit](https://github.com/openstf/adbkit)
* [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js)
* [udevbe/tinyh264](https://github.com/udevbe/tinyh264)

## scrcpy websocket fork

Currently, support of WebSocket protocol added to v1.16 of scrcpy
* [Prebuilt package](/src/public/scrcpy-server.jar)
* [Source code](https://github.com/NetrisTV/scrcpy/tree/feature/websocket-v1.16.x)
