# ws-scrcpy Architecture & Working Guide

A comprehensive guide to how ws-scrcpy works — how video streaming, touch/keyboard controls, and audio playback are orchestrated together in real time.

## Table of Contents

1. [What is ws-scrcpy](#what-is-ws-scrcpy)
2. [High-Level Architecture](#high-level-architecture)
3. [The Three Pillars: Stream, Controls, Audio](#the-three-pillars-stream-controls-audio)
4. [Server Side (Node.js)](#server-side-nodejs)
   - [Entry Point & Service Startup](#entry-point--service-startup)
   - [HTTP & WebSocket Servers](#http--websocket-servers)
   - [Middleware System](#middleware-system)
   - [Device Discovery (ControlCenter + ADB)](#device-discovery-controlcenter--adb)
   - [ScrcpyServer (Launching scrcpy on Device)](#scrcpyserver-launching-scrcpy-on-device)
   - [ScrcpyTcpProxy (The Bridge)](#scrcpytcpproxy-the-bridge)
5. [Browser Side (TypeScript SPA)](#browser-side-typescript-spa)
   - [Entry Point & Action Routing](#entry-point--action-routing)
   - [Device List & Stream Configuration](#device-list--stream-configuration)
   - [StreamClientScrcpy (The Orchestrator)](#streamclientscrcpy-the-orchestrator)
   - [StreamReceiver (WebSocket Packet Dispatch)](#streamreceiver-websocket-packet-dispatch)
   - [Player System (Video Decoding & Rendering)](#player-system-video-decoding--rendering)
   - [AudioPlayer (Opus Decoding & Web Audio)](#audioplayer-opus-decoding--web-audio)
   - [Interaction Handlers (Touch & Scroll)](#interaction-handlers-touch--scroll)
   - [Control Messages (Binary Protocol)](#control-messages-binary-protocol)
   - [Toolbar UI (GoogToolBox)](#toolbar-ui-googtoolbox)
6. [End-to-End Data Flows](#end-to-end-data-flows)
   - [Video Frame: Device Screen → Browser Canvas](#video-frame-device-screen--browser-canvas)
   - [Touch Event: Browser Click → Device Touch](#touch-event-browser-click--device-touch)
   - [Audio Frame: Device Microphone → Browser Speaker](#audio-frame-device-microphone--browser-speaker)
7. [Connection Lifecycle (Full Walkthrough)](#connection-lifecycle-full-walkthrough)
8. [Multiplexer System](#multiplexer-system)
9. [Key File Reference](#key-file-reference)

---

## What is ws-scrcpy

ws-scrcpy is a **web-based Android device mirroring and remote control tool**. It lets you see your Android device's screen in a browser window and interact with it (touch, type, scroll) — all over a network connection.

Under the hood, it uses:
- **scrcpy-server** (a small Java binary from [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy)) running on the Android device to capture the screen, record audio, and inject touch/key events
- **ADB (Android Debug Bridge)** to deploy and communicate with the scrcpy-server
- **Node.js** as a backend that bridges the TCP-based scrcpy protocol to WebSockets
- **Browser** as the frontend with HTML5 video decoders and Web Audio for playback

---

## High-Level Architecture

```
┌─────────────────────┐           ┌──────────────────────────┐           ┌──────────────────────────┐
│   ANDROID DEVICE    │           │      NODE.JS SERVER      │           │        BROWSER           │
│                     │    ADB    │                          │    WS     │                          │
│  scrcpy-server 3.1  │◄────────►│  ControlCenter           │◄────────►│  DeviceTracker           │
│  (Java process)     │  (USB/   │  (device discovery)      │  (device  │  (device list UI)        │
│                     │   WiFi)  │                          │   list)   │                          │
│  ┌───────────────┐  │    TCP   │  ┌────────────────────┐  │    WS     │  ┌────────────────────┐  │
│  │ Video Encoder │──┼─────────►│  │  ScrcpyTcpProxy    │──┼─────────►│  │ StreamReceiver     │  │
│  │ (H.264/H.265) │  │  frames  │  │  (TCP↔WS bridge)   │  │  binary  │  │ (packet dispatch)  │  │
│  └───────────────┘  │         │  └────────────────────┘  │  msgs    │  └─────┬──────────────┘  │
│                     │         │                          │         │        │                   │
│  ┌───────────────┐  │    TCP   │  Same ScrcpyTcpProxy    │    WS     │  ┌─────▼──────────────┐  │
│  │ Audio Capture │──┼─────────►│  instance handles all   │──┼─────────►│  │ AudioPlayer        │  │
│  │ (Opus)        │  │  frames  │  three sockets           │  │  tagged  │  │ (WebCodecs+WebAudio│  │
│  └───────────────┘  │         │                          │  │  pkts   │  └────────────────────┘  │
│                     │         │                          │         │                           │
│  ┌───────────────┐  │    TCP   │                          │    WS     │  ┌────────────────────┐  │
│  │ Input Injector│◄─┼─────────│                          │◄─┼─────────│  │ TouchHandler       │  │
│  │ (Controller)  │  │  binary  │                          │  │  binary │  │ + KeyInputHandler  │  │
│  └───────────────┘  │  cmds   │                          │  │  msgs   │  └────────────────────┘  │
│                     │         │                          │         │                           │
│                     │         │  ┌────────────────────┐  │         │  ┌────────────────────┐  │
│                     │         │  │ Express (static)   │──┼─────────►│  │ HTML/JS/CSS bundle │  │
│                     │         │  └────────────────────┘  │  HTTP    │  └────────────────────┘  │
└─────────────────────┘         └──────────────────────────┘         └──────────────────────────┘
```

**Key insight**: The Node.js server is the central translator. The Android device speaks raw TCP (scrcpy protocol). The browser speaks WebSocket. Node.js bridges them, handling protocol translation, packet tagging, and message filtering.

---

## The Three Pillars: Stream, Controls, Audio

Everything in ws-scrcpy revolves around three concurrent data streams, all flowing through a single WebSocket connection between the browser and Node.js:

### 1. Video Stream (Device → Browser)

```
Android screen → MediaCodec H.264 encoder → TCP socket → Node.js strips headers →
WebSocket → Browser H.264 decoder (WebCodecs/Broadway/MSE) → <canvas> element
```

The device continuously captures screen frames, encodes them as H.264 NAL units, and sends them over TCP. Node.js strips the scrcpy frame headers and forwards raw encoded video to the browser. The browser decodes and renders each frame to a canvas.

### 2. Controls (Browser → Device)

```
Mouse/touch event on <canvas> → coordinate transform → TouchControlMessage binary →
WebSocket → Node.js filters & forwards → TCP control socket → scrcpy InputManager →
Android InputEvent injection
```

Browser touch/mouse events are captured on the canvas overlay, transformed from browser coordinates to device screen coordinates (accounting for rotation, zoom, and aspect ratio), serialized into scrcpy's binary control message format, and sent back through the same WebSocket. Node.js forwards valid control messages to the TCP control socket. scrcpy injects them as native Android input events.

### 3. Audio (Device → Browser)

```
Android AudioRecord (REMOTE_SUBMIX) → Opus encoder → TCP socket → Node.js tags with magic →
WebSocket → Browser AudioDecoder (WebCodecs) → AudioBufferSourceNode → speakers
```

The device captures system audio output, encodes it as Opus frames, and sends them over a separate TCP socket. Node.js tags each frame with a magic prefix (`scrcpy_audio`) so the browser can distinguish audio from video packets on the shared WebSocket. The browser decodes Opus frames and schedules them for playback through the Web Audio API.

### How They Stay In Sync

All three streams are **independent but concurrent**:

- **Video and audio** are inherently synced at the source (the device captures both simultaneously). Minor drift is handled by the AudioPlayer's latency management (drops audio if >100ms behind).
- **Controls** are fire-and-forget from the browser's perspective — there's no acknowledgment. The visual feedback comes from the next video frame that reflects the touch.
- **Single WebSocket, three TCP sockets**: The browser has one WebSocket connection to Node.js. Node.js maintains three separate TCP sockets to the device. The WebSocket multiplexes video frames (no prefix), audio frames (magic prefix), and control messages (sent browser→server only).

---

## Server Side (Node.js)

### Entry Point & Service Startup

**File**: `src/server/index.ts`

The server boots in this sequence:

```
1. Load configuration (Config singleton from YAML/JSON)
2. Dynamically import platform modules:
   ├── Google/Android: ControlCenter, DeviceTracker, ScrcpyTcpProxy, ...
   └── Apple/iOS: ControlCenter, DeviceTracker, WebDriverAgentProxy, ...
3. Start services:
   ├── HttpServer (Express, static files, SSL/TLS)
   ├── WebSocketServer (ws library, connection routing)
   └── ControlCenter (ADB device tracker)
4. Register middleware:
   ├── mwList (direct WebSocket handlers): WebsocketProxy, WebsocketMultiplexer, ScrcpyTcpProxy, ...
   └── mw2List (multiplexed channel handlers): HostTracker, DeviceTracker, RemoteShell, ...
5. Listen for SIGINT/SIGTERM for graceful shutdown
```

Conditional compilation (`#if INCLUDE_GOOG`, `#if INCLUDE_APPL`) controls which platform modules are included in the build.

### HTTP & WebSocket Servers

**HttpServer** (`src/server/services/HttpServer.ts`):
- Express.js application serving the frontend bundle and static assets
- Supports HTTP and HTTPS (with configurable SSL certificates)
- Optional basic auth middleware
- Default port: 8000

**WebSocketServer** (`src/server/services/WebSocketServer.ts`):
- Attaches to the HTTP server for WebSocket upgrades
- Routes incoming connections by `?action=` query parameter
- Iterates registered middleware factories until one handles the connection

```
Browser connects: ws://server:8000/?action=stream-scrcpy-tcp&udid=ABC123
                                          ↑ action determines the middleware
```

### Middleware System

**Base class**: `src/server/mw/Mw.ts`

Every server-side handler extends `Mw` and implements the `MwFactory` interface:

```typescript
interface MwFactory {
    processRequest(ws: WS, params: RequestParameters): Mw | undefined;
    processChannel(ws: Multiplexer, code: string, data?: ArrayBuffer): Mw | undefined;
}
```

The two methods represent two activation paths:
- `processRequest()`: Direct WebSocket connection with an `?action=` parameter
- `processChannel()`: A sub-channel opened on a multiplexed WebSocket (4-byte channel code)

| Middleware | Activation | Purpose |
|-----------|-----------|---------|
| `ScrcpyTcpProxy` | `action=stream-scrcpy-tcp` | **Core**: Bridges scrcpy TCP ↔ Browser WebSocket |
| `WebsocketProxy` | `action=proxy-ws` | Proxies WebSocket to remote servers |
| `WebsocketProxyOverAdb` | `action=proxy-adb` | ADB port-forwarded WebSocket proxy |
| `WebsocketMultiplexer` | `action=multiplex` | Wraps connection in multiplexer |
| `HostTracker` | channel code `HSTS` | Serves list of available device hosts |
| `DeviceTracker` | channel code `GTRC` | Serves live Android device list |
| `RemoteShell` | channel code `SHEL` | PTY-based ADB shell |
| `FileListing` | channel code `FSLS` | File browser operations |
| `RemoteDevtools` | `action=devtools` | Chrome DevTools protocol proxy |

### Device Discovery (ControlCenter + ADB)

**ControlCenter** (`src/server/goog-device/services/ControlCenter.ts`):

Singleton service that manages all connected Android devices:

```
1. Starts ADB device tracker (via adbkit)
2. Tracker emits changeSet events (devices added/removed/changed)
3. For each device: creates Device instance, fetches properties
4. Builds GoogDeviceDescriptor (name, model, interfaces, PID)
5. Emits 'device' events to all connected DeviceTracker middleware
6. Auto-restarts tracker with exponential backoff on failure
```

**Device** (`src/server/goog-device/Device.ts`):

Represents a single Android device:
- Fetches build info (OS version, SDK level, manufacturer, model, CPU arch) via ADB shell
- Detects network interfaces (for WiFi ADB connections)
- Manages scrcpy server lifecycle (start/stop/query PID)
- Multiple PID detection strategies (PIDOF, GREP_PS, LS_PROC) for device compatibility
- Emits 'update' events (throttled at 300ms) when state changes

### ScrcpyServer (Launching scrcpy on Device)

**File**: `src/server/goog-device/ScrcpyServer.ts`

Deploys and launches the scrcpy-server binary on an Android device:

```
1. Push scrcpy-server.jar to /data/local/tmp/ via ADB
2. Launch via: CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process
              / com.genymobile.scrcpy.Server 3.1
              scid=0 log_level=error audio=true audio_codec=opus
              audio_bit_rate=128000 tunnel_forward=true max_size=1920
              control=true 2>&1
3. Poll for the process to appear (up to 10 retries with backoff)
4. Verify via /proc/[pid]/cmdline that it's the correct version
5. Kill old/incompatible versions automatically
```

The server runs as an `app_process` with scrcpy-server.jar on its classpath. It creates an abstract Unix socket (`scrcpy_00000000`) that clients connect to via ADB port forwarding.

### ScrcpyTcpProxy (The Bridge)

**File**: `src/server/goog-device/mw/ScrcpyTcpProxy.ts`

This is the **heart of the system** — the component that translates between scrcpy's TCP protocol and the browser's WebSocket. It handles all three data streams (video, audio, control) over one WebSocket.

**Initialization sequence**:

```
1. Query screen size via ADB (wm size command)
2. ADB-forward the scrcpy abstract socket to a local TCP port
3. Open 3 sequential TCP connections to that port:
   ├── Connection 1: Video socket
   ├── Connection 2: Audio socket
   └── Connection 3: Control socket
4. Start audio pipeline (background)
5. Read video handshake, build scrcpy_initial message, start video pipeline
```

**Video pipeline**:

```
TCP video socket → readExact(1 byte dummy) → readExact(64 bytes device name) →
readExact(12 bytes: codec_id + width + height) → read first config frame →
build scrcpy_initial binary message → send to WebSocket →
enter streaming loop: read 12-byte header + payload → strip header → send payload to WebSocket
```

The `scrcpy_initial` message is a synthetic binary blob that mimics what the old ws-scrcpy WebSocket protocol sent. This maintains backward compatibility with `StreamReceiver` on the browser side.

**Audio pipeline**:

```
TCP audio socket → readExact(4 bytes codec_id) → if OPUS:
enter streaming loop: read 12-byte header + payload → strip header →
prepend "scrcpy_audio\0\0\0" magic (15 bytes) + config flag (1 byte) → send to WebSocket
```

Audio frames are tagged with a unique 15-byte magic prefix so `StreamReceiver` can distinguish them from video frames on the shared WebSocket.

**Control pipeline** (reverse direction):

```
Browser WebSocket → onSocketMessage() → validate message type (must be 0-17) →
forward raw bytes to TCP control socket
```

Messages with type > 17 are silently dropped (ws-scrcpy custom types like 101/102 that scrcpy v3.1 doesn't understand).

**Error isolation**: The control socket has independent error handling. If it fails (e.g., device rejects INJECT_EVENTS permission), video and audio continue unaffected.

---

## Browser Side (TypeScript SPA)

### Entry Point & Action Routing

**File**: `src/app/index.ts`

The browser app is a single-page application. On load:

```
1. window.onload fires
2. Parse URL query parameters
3. Conditionally register video players (compile-time flags):
   ├── BroadwayPlayer (WebAssembly H.264)
   ├── TinyH264Player (WebWorker H.264)
   ├── WebCodecsPlayer (WebCodecs API)
   └── MsePlayer (MediaSource Extensions)
4. Route based on ?action= parameter:
   ├── "stream" + udid → StreamClientScrcpy.start()
   ├── "shell"          → ShellClient.start()
   ├── "devtools"       → DevtoolsClient.start()
   ├── "list-files"     → FileListingClient.start()
   └── (none)           → HostTracker.start() → shows device list
```

### Device List & Stream Configuration

When no `action` parameter is present, the browser shows the **device list page**:

**HostTracker** (`src/app/client/HostTracker.ts`):
- Opens a multiplexed WebSocket to the server
- Requests list of available hosts (local + remote)
- For each host, creates a **DeviceTracker** instance

**DeviceTracker** (`src/app/googDevice/client/DeviceTracker.ts`):
- Connects to a host's device tracker endpoint
- Receives live device list updates
- Renders an HTML table with device info and action buttons
- Each device row has a "Configure stream" button

**ConfigureScrcpy** (`src/app/googDevice/client/ConfigureScrcpy.ts`):
- Modal dialog that opens when clicking "Configure stream"
- Lets the user choose:
  - Video player implementation (BroadwayPlayer, WebCodecsPlayer, MsePlayer, etc.)
  - Video settings (bitrate, FPS, I-frame interval, max resolution)
  - Display selection (for multi-display devices)
  - Encoder selection (if device has multiple H.264 encoders)
  - Fit-to-screen mode
- Clicking OK navigates to `/?action=stream&udid=...&player=...`

### StreamClientScrcpy (The Orchestrator)

**File**: `src/app/googDevice/client/StreamClientScrcpy.ts`

This is the **browser-side counterpart** to ScrcpyTcpProxy — it orchestrates all browser-side components for a streaming session.

**Construction sequence** (triggered by URL with `?action=stream`):

```
1. Create StreamReceiverScrcpy (opens WebSocket to server)
2. Set body class to 'stream' (applies stream page CSS)
3. Call startStream():

   a. Instantiate the chosen video player (e.g., WebCodecsPlayer)
   b. Create DOM structure:
      ├── device-view (main container)
      │   ├── control-buttons-list (GoogToolBox sidebar)
      │   ├── video (flex container)
      │   │   └── phone-container (transform target for zoom/rotation)
      │   │       ├── video-loading-overlay (spinner, shown until first frame)
      │   │       ├── <canvas class="video-layer"> (player renders here)
      │   │       └── <canvas class="touch-layer"> (captures input events)
      │   └── moreBox (advanced settings panel)

   c. Set up interaction handlers:
      ├── FeaturedInteractionHandler (touch/mouse/scroll on canvas)
      └── KeyInputHandler (keyboard events, global)

   d. Set up file push handler (drag-and-drop APK install)

   e. Initialize AudioPlayer (if WebCodecs AudioDecoder supported)

   f. Register event listeners on StreamReceiver:
      ├── 'video'        → push frame to player
      ├── 'audio'        → push packet to AudioPlayer
      ├── 'displayInfo'  → update screen dimensions
      ├── 'clientsStats' → update title with device name
      ├── 'deviceMessage' → forward to GoogMoreBox
      └── 'disconnected'  → cleanup everything
```

**Key responsibilities**:
- Instantiates and wires together ALL browser-side components
- Owns the `sendMessage(msg)` method that all control messages flow through
- Manages video settings negotiation with the server
- Handles fit-to-screen calculations
- Provides `setMuted(bool)` for audio mute control
- Provides `setHandleKeyboardEvents(bool)` for keyboard capture toggle

### StreamReceiver (WebSocket Packet Dispatch)

**File**: `src/app/client/StreamReceiver.ts`

Sits between the WebSocket and all consumers. Every binary message from the server arrives here and gets dispatched based on magic prefix detection:

```
WebSocket message (ArrayBuffer) arrives
  │
  ├── First 14 bytes == "scrcpy_initial"?  → handleInitialInfo()
  │   Parses: device name, display info, screen info, video settings, encoders, client ID
  │   Emits: 'clientsStats', 'displayInfo', 'encoders', 'rotated'
  │
  ├── First 14 bytes == DeviceMessage magic? → parse DeviceMessage
  │   Emits: 'deviceMessage' (clipboard content, etc.)
  │
  ├── First 15 bytes == "scrcpy_audio\0\0\0"? → extract audio payload
  │   Emits: 'audio' (Uint8Array: config flag byte + Opus data)
  │
  └── None of the above → it's a video frame
      Emits: 'video' (ArrayBuffer: raw H.264 NAL units)
```

The 15-byte audio magic is deliberately a different length from the 14-byte initial/message magics to prevent false matches.

### Player System (Video Decoding & Rendering)

**Base class**: `src/app/player/BasePlayer.ts`

Abstract player providing:
- Video settings management (bitrate, resolution, FPS) with localStorage persistence
- Screen info tracking (device dimensions, rotation)
- Zoom support: `zoomIn()`, `zoomOut()`, `resetZoom()` with CSS transforms on phone-container
- UI rotation: `rotateScreen()` cycles through 0°/90°/180°/270°
- Playback quality stats (FPS, bitrate, decode time)
- Screenshot capability
- Loading overlay management

**Player implementations** (all extend `BaseCanvasBasedPlayer` or `BasePlayer`):

| Player | Decoder | Browser Support | Performance | Notes |
|--------|---------|-----------------|-------------|-------|
| **WebCodecsPlayer** | `VideoDecoder` API | Chrome 94+, Edge 94+ | Best | Hardware-accelerated, lowest latency |
| **MsePlayer** | MediaSource Extensions | Chrome, Firefox, Safari | Good | Uses h264-converter to wrap NALUs in MP4 container, plays via `<video>` element |
| **BroadwayPlayer** | Broadway.js (WASM) | All modern browsers | Moderate | Pure software H.264 decoder in WebAssembly |
| **TinyH264Player** | tinyh264 (WebWorker) | All modern browsers | Moderate | WASM decoder running in background thread |

**Frame flow** through a canvas-based player:

```
player.pushFrame(Uint8Array)
  → Queue frame for decoding
  → Decoder produces raw YUV/RGB frame
  → requestAnimationFrame callback
  → Draw frame to <canvas> (WebGL or 2D context)
  → Hide loading overlay on first successful frame
```

### AudioPlayer (Opus Decoding & Web Audio)

**File**: `src/app/player/AudioPlayer.ts`

Decodes Opus audio from the stream and plays it through Web Audio API:

**Architecture**:
```
pushAudioData(Uint8Array)
  │
  ├── byte[0] == 0x01 (config packet)?
  │   Store as pendingDescription → configure AudioDecoder when AudioContext is running
  │
  └── byte[0] == 0x00 (data packet)?
      ├── if !playing → DROP (AudioContext still suspended)
      ├── if muted → DROP
      └── else: create EncodedAudioChunk → AudioDecoder.decode()
                → onDecodedFrame() callback
                → create AudioBuffer from decoded samples
                → create AudioBufferSourceNode
                → schedule playback at nextPlayTime
                → nextPlayTime += buffer.duration
```

**Key design decisions**:
- **AudioContext created eagerly** in constructor (during user click gesture) — avoids 10-15s startup delay
- **Drops packets while AudioContext suspended** — prevents 5-6s accumulated delay on resume
- **100ms latency ceiling** — if `nextPlayTime` drifts > 100ms behind `currentTime`, resets to now
- **Mute discards decoded frames** — no scheduling when muted, reset nextPlayTime on unmute

### Interaction Handlers (Touch & Scroll)

**File**: `src/app/interactionHandler/FeaturedInteractionHandler.ts`

Captures browser input events and translates them to scrcpy control messages:

**Touch/Mouse handling**:
```
Browser MouseEvent/TouchEvent on touch-layer canvas
  │
  ├── Get player's ScreenInfo (device dimensions)
  ├── Get player's UI rotation and zoom level
  ├── Transform browser (clientX, clientY) → device (x, y):
  │   1. Subtract canvas offset from browser coordinates
  │   2. Scale by (deviceWidth / canvasWidth) accounting for zoom
  │   3. Rotate coordinates based on UI rotation
  │   4. Clamp to device screen bounds
  │
  ├── Map browser event type to Android MotionEvent action:
  │   mousedown/touchstart  → ACTION_DOWN
  │   mousemove/touchmove   → ACTION_MOVE
  │   mouseup/touchend      → ACTION_UP
  │   touchcancel           → ACTION_CANCEL
  │
  └── Create TouchControlMessage(action, pointerId, position, pressure, buttons)
      → listener.sendMessage(msg)  // StreamClientScrcpy
```

**Scroll handling**:
```
Browser WheelEvent on touch-layer canvas
  │
  ├── Throttle: max one event per 30ms
  ├── Convert deltaX/deltaY to direction: -1, 0, or 1
  ├── Transform position (same as touch)
  └── Create ScrollControlMessage(position, hScroll, vScroll)
      → listener.sendMessage(msg)
```

**Multi-touch**: Maintains separate `storedFromMouseEvent` and `storedFromTouchEvent` Maps to track active pointers. Sends ACTION_UP for all active pointers on mouse leave.

### Control Messages (Binary Protocol)

**Base class**: `src/app/controlMessage/ControlMessage.ts`

All control messages serialize to a `Buffer` with a 1-byte type header followed by type-specific payload:

```
[1 byte: type] [N bytes: payload]
```

| Type | Name | Payload Size | Fields |
|------|------|-------------|--------|
| 0 | TYPE_KEYCODE | 13 bytes | action(1) + keycode(4) + repeat(4) + metaState(4) |
| 1 | TYPE_TEXT | 4 + len bytes | textLength(4) + UTF-8 text(variable) |
| 2 | TYPE_TOUCH | 31 bytes | action(1) + pointerId(8) + x(4) + y(4) + w(2) + h(2) + pressure(2) + actionButton(4) + buttons(4) |
| 3 | TYPE_SCROLL | 20 bytes | x(4) + y(4) + w(2) + h(2) + hScroll(2) + vScroll(2) + buttons(4) |
| 4-11 | Commands | varies | Back, expand panels, clipboard, screen power, rotate |
| 101* | CHANGE_STREAM_PARAMS | varies | VideoSettings buffer (ws-scrcpy extension, filtered by proxy) |
| 102* | PUSH_FILE | varies | File push protocol (ws-scrcpy extension, filtered by proxy) |

*Types 101 and 102 are ws-scrcpy custom extensions not part of official scrcpy. They are filtered out by ScrcpyTcpProxy before reaching the device.

### Toolbar UI (GoogToolBox)

**Files**: `src/app/toolbox/ToolBox.ts`, `src/app/googDevice/toolbox/GoogToolBox.ts`

The floating sidebar control panel on the stream page:

```
┌──────────┐
│   ━━━    │  ← Drag handle (grab to reposition)
│   ─      │  ← Toggle button (collapse/expand)
├──────────┤
│  ⏻ Power │  ← ToolBoxButton: sends KeyCodeControlMessage(KEYCODE_POWER)
│  🔊 Vol+  │  ← ToolBoxButton: sends KeyCodeControlMessage(KEYCODE_VOLUME_UP)
│  🔉 Vol-  │  ← ToolBoxButton: sends KeyCodeControlMessage(KEYCODE_VOLUME_DOWN)
│  ◀ Back   │  ← ToolBoxButton: sends KeyCodeControlMessage(KEYCODE_BACK)
│  ● Home   │  ← ToolBoxButton: sends KeyCodeControlMessage(KEYCODE_HOME)
│  ■ Recent │  ← ToolBoxButton: sends KeyCodeControlMessage(KEYCODE_APP_SWITCH)
│  📷 Shot  │  ← ToolBoxButton: calls player.createScreenshot()
│  🔍+ Zoom │  ← ToolBoxButton: calls player.zoomIn()
│  🔍- Zoom │  ← ToolBoxButton: calls player.zoomOut()
│  🔍⟳ Reset│  ← ToolBoxButton: calls player.resetZoom()
│  🔄 Rotate│  ← ToolBoxButton: calls player.rotateScreen()
│  🔊/🔇 Audio│ ← ToolBoxCheckbox: calls client.setMuted(bool)
│  ⌨ Keyboard│  ← ToolBoxCheckbox: calls client.setHandleKeyboardEvents(bool)
└──────────┘
```

**ToolBoxButton**: Simple press button. Sends `KeyCodeControlMessage` with `ACTION_DOWN` on mousedown and `ACTION_UP` on mouseup (mimics physical button press/release).

**ToolBoxCheckbox**: Toggle with two icons. Uses CSS `two-images` class for visual state swap. Calls a callback with the checked state on click.

**ToolBox container features**:
- Draggable (mouse and touch) with viewport boundary constraints
- Collapsible with animated transition
- Responsive (bottom bar on mobile, vertical sidebar on desktop)

---

## End-to-End Data Flows

### Video Frame: Device Screen → Browser Canvas

```
Step 1 │ Android SurfaceFlinger captures screen update
Step 2 │ scrcpy-server's ScreenEncoder records via MediaCodec (H.264 hardware encoder)
Step 3 │ Encoded NAL unit written to video TCP socket:
       │   [8 bytes: flags+PTS] [4 bytes: size] [N bytes: H.264 data]
Step 4 │ ScrcpyTcpProxy.streamFrames() reads from TCP socket:
       │   - Accumulates data in rolling buffer
       │   - Parses 12-byte headers, extracts payload
       │   - Sends raw H.264 payload over WebSocket (no header)
Step 5 │ Browser WebSocket receives ArrayBuffer
Step 6 │ StreamReceiver.onSocketMessage():
       │   - No magic prefix match → emit('video', data)
Step 7 │ StreamClientScrcpy.onVideo():
       │   - player.pushFrame(new Uint8Array(data))
Step 8 │ Player decodes H.264 NAL units:
       │   WebCodecsPlayer: VideoDecoder.decode(EncodedVideoChunk)
       │   BroadwayPlayer: Decoder.decode(nalUnit)
       │   MsePlayer: H264Converter → SourceBuffer.appendBuffer()
Step 9 │ Decoded frame rendered to <canvas> via WebGL or 2D context
```

**Latency**: Typically 50-150ms end-to-end (hardware encoding + network + decoding).

### Touch Event: Browser Click → Device Touch

```
Step 1  │ User clicks/taps on touch-layer <canvas>
Step 2  │ FeaturedInteractionHandler.onInteraction(MouseEvent):
        │   a. Get ScreenInfo from player (device dimensions)
        │   b. Get UI rotation and zoom level
        │   c. Transform (clientX, clientY) → (deviceX, deviceY)
        │   d. Map mousedown → MotionEvent.ACTION_DOWN
        │   e. Calculate pressure (1.0 for mouse, event.force for touch)
Step 3  │ Create TouchControlMessage:
        │   Buffer = [0x02] [ACTION_DOWN:1] [pointerId:8] [x:4] [y:4]
        │            [screenW:2] [screenH:2] [pressure:2] [actionBtn:4] [buttons:4]
        │   Total: 32 bytes (1 type + 31 payload)
Step 4  │ StreamClientScrcpy.sendMessage(msg)
        │   → StreamReceiver.sendEvent(msg)
        │   → ws.send(msg.toBuffer())
Step 5  │ Node.js WebSocket receives binary message
Step 6  │ ScrcpyTcpProxy.onSocketMessage():
        │   a. Read first byte: type = 2 (TYPE_TOUCH), valid (≤ 17)
        │   b. Forward raw buffer to TCP control socket
Step 7  │ scrcpy-server ControlMessageReader:
        │   a. Read type byte → dispatch to InjectTouchEventReader
        │   b. Parse 31 payload bytes → create android.view.MotionEvent
Step 8  │ scrcpy-server Controller:
        │   InputManager.injectInputEvent(motionEvent, InputManager.INJECT_INPUT_EVENT_MODE_ASYNC)
Step 9  │ Android processes the touch event as if the user touched the screen
Step 10 │ Screen updates → next video frame captures the result
```

### Audio Frame: Device Microphone → Browser Speaker

```
Step 1  │ Android captures system audio via AudioRecord (REMOTE_SUBMIX source)
Step 2  │ scrcpy-server's AudioEncoder encodes PCM → Opus via MediaCodec
Step 3  │ Encoded Opus frame written to audio TCP socket:
        │   [8 bytes: flags+PTS] [4 bytes: size] [N bytes: Opus data]
        │   First frame has IS_CONFIG flag set (codec-specific data)
Step 4  │ ScrcpyTcpProxy.streamFrames(socket, isAudio=true):
        │   a. Parse 12-byte header, extract IS_CONFIG flag
        │   b. Build tagged packet:
        │      ["scrcpy_audio\0\0\0"] [0x01 or 0x00 config flag] [Opus payload]
        │   c. Send over WebSocket
Step 5  │ Browser WebSocket receives ArrayBuffer
Step 6  │ StreamReceiver.onSocketMessage():
        │   - First 15 bytes match MAGIC_BYTES_AUDIO
        │   - emit('audio', Uint8Array starting after magic)
Step 7  │ StreamClientScrcpy.onAudio():
        │   - audioPlayer.resume() (nudge AudioContext)
        │   - audioPlayer.pushAudioData(data)
Step 8  │ AudioPlayer.pushAudioData():
        │   a. byte[0] == 1? → initDecoder(payload) stores config, sets up AudioDecoder
        │   b. byte[0] == 0? → if playing && !muted:
        │      Create EncodedAudioChunk(type='key', timestamp, data)
        │      decoder.decode(chunk)
Step 9  │ AudioDecoder calls onDecodedFrame(AudioData):
        │   a. Create AudioBuffer from decoded PCM samples (48kHz, 2ch, f32-planar)
        │   b. Create AudioBufferSourceNode
        │   c. Connect to AudioContext.destination
        │   d. Schedule: source.start(nextPlayTime)
        │   e. Advance: nextPlayTime += buffer.duration
Step 10 │ Web Audio API plays scheduled audio through speakers
```

---

## Connection Lifecycle (Full Walkthrough)

### Phase 1: Device List Page

```
User opens http://server:8000/
  ↓
Browser loads index.html + bundle.js
  ↓
No ?action= → HostTracker.start()
  ↓
Opens multiplexed WebSocket: ws://server:8000/?action=multiplex
  ↓
Creates channel with code "HSTS" → server responds with host list
  ↓
For each host: creates DeviceTracker → opens channel "GTRC"
  ↓
Server's ControlCenter sends device descriptors
  ↓
Browser renders device table with "Configure stream" buttons
```

### Phase 2: Stream Configuration

```
User clicks "Configure stream" on a device
  ↓
ConfigureScrcpy dialog opens
  ↓
Creates temporary StreamReceiverScrcpy to fetch device capabilities:
  - Available encoders
  - Display list (for multi-display)
  - Current video settings
  ↓
User selects player, adjusts settings, clicks OK
  ↓
Browser navigates to:
  /?action=stream&udid=ABC123&player=WebCodecsPlayer&ws=...
```

### Phase 3: Stream Session Startup

```
Browser loads with ?action=stream
  ↓
StreamClientScrcpy.start(params) called
  ↓
Creates StreamReceiverScrcpy → opens WebSocket:
  ws://server:8000/?action=stream-scrcpy-tcp&udid=ABC123
  ↓
Server: WebSocketServer routes to ScrcpyTcpProxy
  ↓
ScrcpyTcpProxy.init():
  ├── ADB shell: wm size → gets screen dimensions
  ├── ADB forward: localabstract:scrcpy_00000000 → tcp:PORT
  ├── TCP connect #1 → video socket
  ├── TCP connect #2 → audio socket
  └── TCP connect #3 → control socket
  ↓
ScrcpyTcpProxy reads video handshake:
  1 byte dummy + 64 bytes name + 12 bytes (codec + w + h)
  ↓
Builds scrcpy_initial binary → sends over WebSocket
  ↓
Browser StreamReceiver receives scrcpy_initial:
  → Parses device name, display info, screen info
  → Emits 'clientsStats', 'displayInfo'
  ↓
StreamClientScrcpy.onDisplayInfo():
  → Sets screen info on player
  → Player starts: play() → enters PLAYING state
  → Hides loading overlay on first decoded frame
  ↓
Video frames start flowing (TCP → WebSocket → player.pushFrame())
Audio frames start flowing (TCP → tagged WebSocket → AudioPlayer)
Controls ready (browser → WebSocket → TCP control socket → device)
```

### Phase 4: Active Streaming

```
Concurrent streams running:

  VIDEO (60fps):  Device → TCP → ScrcpyTcpProxy → WS → StreamReceiver → Player → Canvas
  AUDIO (50fps):  Device → TCP → ScrcpyTcpProxy → WS → StreamReceiver → AudioPlayer → Speakers
  CONTROL:        Canvas → TouchHandler → WS → ScrcpyTcpProxy → TCP → Device InputManager
```

### Phase 5: Disconnection

```
User closes browser tab (or navigates away)
  ↓
WebSocket closes
  ↓
Server: ScrcpyTcpProxy.release()
  ├── Destroys video TCP socket
  ├── Destroys audio TCP socket
  └── Destroys control TCP socket
  ↓
scrcpy-server detects client disconnect → exits
  ↓
Browser: StreamClientScrcpy.onDisconnected()
  ├── audioPlayer.stop() → closes AudioContext + AudioDecoder
  ├── touchHandler.release() → removes event listeners
  ├── filePushHandler.release()
  └── player.stop() → stops rendering
```

---

## Multiplexer System

**Files**: `src/packages/multiplexer/`

The multiplexer enables **multiple logical channels over a single WebSocket**. This is used for the device list page where the browser needs concurrent connections to HostTracker, DeviceTracker, RemoteShell, and FileListing — all over one WebSocket.

**Note**: The video stream does NOT use the multiplexer. `StreamClientScrcpy` opens a dedicated direct WebSocket for the stream because of the high bandwidth requirements and latency sensitivity.

**Binary message format**:
```
[1 byte: MessageType] [4 bytes: channelId (UInt32LE)] [N bytes: payload]
```

**Message types**:
- `CreateChannel` (4): Opens a new sub-channel
- `CloseChannel` (8): Closes a channel with code/reason
- `RawBinaryData` (16): Binary payload on a channel
- `RawStringData` (32): String payload on a channel
- `Data` (64): Typed data payload

**Channel creation flow**:
```
Browser: multiplexer.createChannel(initData)
  → Sends CreateChannel message with new channelId + initData
  → initData first 4 bytes = channel code (e.g., "GTRC")
  ↓
Server: WebsocketMultiplexer receives CreateChannel
  → Extracts 4-byte code from initData
  → Iterates mw2List factories: factory.processChannel(multiplexer, code, data)
  → Matching factory creates middleware instance for that channel
  ↓
Channel established: both sides can send/receive independently
```

---

## Key File Reference

### Server Side

| File | Purpose |
|------|---------|
| `src/server/index.ts` | Entry point: boots services, registers middleware |
| `src/server/Config.ts` | Configuration singleton (YAML/JSON) |
| `src/server/services/HttpServer.ts` | Express HTTP/HTTPS server |
| `src/server/services/WebSocketServer.ts` | WebSocket connection routing |
| `src/server/mw/Mw.ts` | Middleware base class and MwFactory interface |
| `src/server/mw/WebsocketMultiplexer.ts` | Multiplexer activation middleware |
| `src/server/mw/HostTracker.ts` | Serves available device hosts |
| `src/server/goog-device/services/ControlCenter.ts` | ADB device tracking and management |
| `src/server/goog-device/Device.ts` | Single Android device representation |
| `src/server/goog-device/AdbUtils.ts` | ADB utility functions |
| `src/server/goog-device/ScrcpyServer.ts` | Deploys and launches scrcpy on device |
| `src/server/goog-device/mw/ScrcpyTcpProxy.ts` | **Core**: TCP↔WebSocket bridge for video/audio/control |
| `src/server/goog-device/mw/DeviceTracker.ts` | Device list WebSocket middleware |
| `src/server/goog-device/mw/RemoteShell.ts` | ADB shell via PTY |
| `src/server/goog-device/mw/FileListing.ts` | File browser operations |
| `src/common/Constants.ts` | scrcpy server arguments and socket name |
| `src/common/Action.ts` | ACTION enum for URL routing |

### Browser Side

| File | Purpose |
|------|---------|
| `src/app/index.ts` | Entry point: player registration, action routing |
| `src/app/client/ManagerClient.ts` | WebSocket base class with multiplexer support |
| `src/app/client/HostTracker.ts` | Device host discovery |
| `src/app/client/StreamReceiver.ts` | WebSocket packet dispatch (video/audio/initial) |
| `src/app/googDevice/client/DeviceTracker.ts` | Device list UI |
| `src/app/googDevice/client/ConfigureScrcpy.ts` | Stream configuration dialog |
| `src/app/googDevice/client/StreamClientScrcpy.ts` | **Core**: Stream session orchestrator |
| `src/app/player/BasePlayer.ts` | Abstract player base (zoom, rotation, stats) |
| `src/app/player/WebCodecsPlayer.ts` | WebCodecs VideoDecoder player |
| `src/app/player/MsePlayer.ts` | MediaSource Extensions player |
| `src/app/player/BroadwayPlayer.ts` | Broadway.js WASM player |
| `src/app/player/TinyH264Player.ts` | tinyh264 WebWorker player |
| `src/app/player/AudioPlayer.ts` | Opus decoding + Web Audio playback |
| `src/app/interactionHandler/FeaturedInteractionHandler.ts` | Touch/mouse/scroll → control messages |
| `src/app/interactionHandler/InteractionHandler.ts` | Base interaction handler (coordinate transforms) |
| `src/app/controlMessage/ControlMessage.ts` | Control message base + type constants |
| `src/app/controlMessage/TouchControlMessage.ts` | Touch event binary format (31 bytes payload) |
| `src/app/controlMessage/ScrollControlMessage.ts` | Scroll event binary format (20 bytes payload) |
| `src/app/controlMessage/KeyCodeControlMessage.ts` | Key event binary format (13 bytes payload) |
| `src/app/controlMessage/TextControlMessage.ts` | Text injection binary format |
| `src/app/controlMessage/CommandControlMessage.ts` | Generic command messages |
| `src/app/toolbox/ToolBox.ts` | Draggable/collapsible toolbar container |
| `src/app/toolbox/ToolBoxButton.ts` | Simple press button component |
| `src/app/toolbox/ToolBoxCheckbox.ts` | Toggle checkbox component |
| `src/app/googDevice/toolbox/GoogToolBox.ts` | Android-specific toolbar (buttons + audio mute) |
| `src/app/googDevice/toolbox/GoogMoreBox.ts` | Advanced settings panel |
| `src/app/ui/SvgImage.ts` | SVG icon registry |
| `src/style/app.css` | All application styles |

### Shared

| File | Purpose |
|------|---------|
| `src/packages/multiplexer/Multiplexer.ts` | WebSocket channel multiplexer |
| `src/packages/multiplexer/Message.ts` | Multiplexer binary message format |
| `src/app/VideoSettings.ts` | Video encoding parameters (serializable) |
| `src/app/ScreenInfo.ts` | Device screen geometry (25 bytes) |
| `src/app/DisplayInfo.ts` | Display metadata (24 bytes) |
| `src/types/ParamsStreamScrcpy.ts` | Stream session parameters type |
| `vendor/Genymobile/scrcpy/scrcpy-server.jar` | scrcpy v3.1 server binary |
