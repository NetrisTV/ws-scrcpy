# ws scrcpy

Web client for [Genymobile/scrcpy][scrcpy] and more.

## Requirements

Browser must support the following technologies:
* WebSockets
* Media Source Extensions and h264 decoding;
* WebWorkers
* WebAssembly

Server:
* Node.js v10+
* node-gyp ([installation](https://github.com/nodejs/node-gyp#installation))
* `adb` executable must be available in the PATH environment variable

Device:
* Android 5.0+ (API 21+)
* Enabled [adb debugging](https://developer.android.com/studio/command-line/adb.html#Enabling)
* On some devices, you also need to enable
[an additional option](https://github.com/Genymobile/scrcpy/issues/70#issuecomment-373286323)
to control it using keyboard and mouse.

## Build and Start

Make sure you have installed [node.js](https://nodejs.org/en/download/),
[node-gyp](https://github.com/nodejs/node-gyp) and
[build tools](https://github.com/nodejs/node-gyp#installation)
```shell
git clone https://github.com/NetrisTV/ws-scrcpy.git
cd ws-scrcpy

## For stable version find latest tag and switch to it:
# git tag -l
# git checkout vX.Y.Z

npm install
npm start
```

## Supported features

### Screen casting
The modified [version][fork] of [Genymobile/scrcpy][scrcpy] used to stream
H264-video, which then decoded by one of included decoders:

* MsePlayer, formerly "native" ([code](/src/app/player/MsePlayer.ts)). Based on
[xevokk/h264-converter][xevokk/h264-converter]. TL;DR. HTML5 Video.<br>
Requires [Media Source API][MSE] and `video/mp4; codecs="avc1.42E01E"`
[support][isTypeSupported]. Creates mp4 containers from NALU, received from a
device, then feeds them to [MediaSource][MediaSource]. In theory, it can use
hardware acceleration.
* BroadwayPlayer ([code](/src/app/player/BroadwayPlayer.ts)). Based on
[mbebenita/Broadway][broadway] and [131/h264-live-player][h264-live-player].<br>
Requires [WebAssembly][wasm] and preferably [WebGL][webgl] support.
* TinyH264Player ([code](/src/app/player/TinyH264Player.ts)). Based on
[udevbe/tinyh264][tinyh264].<br>
Requires [WebAssembly][wasm], [WebWorkers][workers], [WebGL][webgl] support.

### Remote control
* Touch events (including multi-touch)
* Multi-touch emulation: <kbd>CTRL</kbd> to start with center at the center of
the screen, <kbd>SHIFT</kbd> + <kbd>CTRL</kbd> to start with center at the
current point
* Capturing keyboard events
* Injecting text (ASCII only)
* Copy to/from device clipboard
* Device "rotation"

### File push
Drag & drop an APK file to push it to the `/data/local/tmp` directory. You can
install it manually from the included [xtermjs/xterm.js][xterm.js] terminal
emulator (see below).

### Remote shell
Control your device from `adb shell` in your browser.

### Debug WebPages/WebView
[/docs/Devtools.md](/docs/Devtools.md)

## Known issues

* New versions are most likely not incompatible with previous ones. If you do
upgrade, then manually stop `app_process` or just reboot the device.
* The server on the Android Emulator listens on the internal interface and not
available from the outside (select `proxy over adb` in interfaces list)
* Tinyh264Decoder may fail to start, try to reload the page.
* MseDecoder reports too many dropped frames in quality statistics: needs
further investigation.

## Security warning
Be advised and keep in mind:
* There is no encryption between browser and node.js server (plain HTTP).
* There is no encryption between browser and WebSocket server (plain WS).
* There is no authorization on any level.
* The modified version of scrcpy with integrated WebSocket server is listening
for connections on all network interfaces.
* The modified version of scrcpy will keep running after the last client
disconnected.

## WS QVH
This project also contains front-end for
[NetrisTV/ws-qvh](https://github.com/NetrisTV/ws-qvh) - application for screen
streaming and control of iOS devices in a browser.

Run this to build it:

```shell script
npm install
npm run dist:qvhack:frontend
```

## Related projects
* [Genymobile/scrcpy][scrcpy]
* [xevokk/h264-converter][xevokk/h264-converter]
* [131/h264-live-player][h264-live-player]
* [mbebenita/Broadway][broadway]
* [DeviceFarmer/adbkit][adbkit]
* [xtermjs/xterm.js][xterm.js]
* [udevbe/tinyh264][tinyh264]

## scrcpy websocket fork

Currently, support of WebSocket protocol added to v1.17 of scrcpy
* [Prebuilt package](/vendor/Genymobile/scrcpy/scrcpy-server.jar)
* [Source code][fork]

[fork]: https://github.com/NetrisTV/scrcpy/tree/feature/websocket-v1.17.x

[scrcpy]: https://github.com/Genymobile/scrcpy
[xevokk/h264-converter]: https://github.com/xevokk/h264-converter
[h264-live-player]: https://github.com/131/h264-live-player
[broadway]: https://github.com/mbebenita/Broadway
[adbkit]: https://github.com/DeviceFarmer/adbkit
[xterm.js]: https://github.com/xtermjs/xterm.js
[tinyh264]: https://github.com/udevbe/tinyh264

[MSE]: https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API
[isTypeSupported]: https://developer.mozilla.org/en-US/docs/Web/API/MediaSource/isTypeSupported
[MediaSource]: https://developer.mozilla.org/en-US/docs/Web/API/MediaSource
[wasm]: https://developer.mozilla.org/en-US/docs/WebAssembly
[webgl]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
[workers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
