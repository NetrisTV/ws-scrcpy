# Audio Support for ws-scrcpy: scrcpy v1.19-ws6 → v3.1 Migration

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [scrcpy v3.1 Protocol](#scrcpy-v31-protocol)
4. [Implementation Changes](#implementation-changes)
   - [Step 1: Replace scrcpy-server Binary](#step-1-replace-scrcpy-server-binary)
   - [Step 2: Update Server Launch Arguments](#step-2-update-server-launch-arguments)
   - [Step 3: Create ScrcpyTcpProxy (TCP-to-WebSocket Bridge)](#step-3-create-scrcpytcpproxy-tcp-to-websocket-bridge)
   - [Step 4: Update StreamReceiver (Browser-Side Packet Dispatch)](#step-4-update-streamreceiver-browser-side-packet-dispatch)
   - [Step 5: Create AudioPlayer (Opus Decoding + Playback)](#step-5-create-audioplayer-opus-decoding--playback)
   - [Step 6: Wire Audio into StreamClientScrcpy](#step-6-wire-audio-into-streamclientscrcpy)
   - [Step 7: Fix Control Message Formats](#step-7-fix-control-message-formats)
   - [Step 8: Add Mute/Unmute UI Control](#step-8-add-muteunmute-ui-control)
5. [Files Changed Summary](#files-changed-summary)
6. [Known Limitations](#known-limitations)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## Problem Statement

ws-scrcpy originally used a **custom-forked scrcpy-server.jar (v1.19-ws6)** that was modified to speak WebSocket natively. This custom fork predated scrcpy's audio support entirely — audio capture was introduced in the official scrcpy v2.0 (March 2023).

To add audio streaming, we needed to upgrade from the custom v1.19-ws6 JAR to the **official scrcpy-server v3.1**. However, this isn't a simple drop-in replacement because:

1. **Protocol change**: The v1.19-ws6 fork spoke WebSocket directly. Official scrcpy v3.1 speaks raw **TCP sockets** over ADB-forwarded abstract Unix sockets.
2. **Argument format change**: v1.19-ws6 used positional arguments. v3.1 uses `key=value` arguments.
3. **Connection model change**: v1.19-ws6 opened a single connection. v3.1 requires **3 sequential TCP connections** (video, audio, control) to the same port.
4. **Control message format changes**: Several control message binary formats changed between versions (payload sizes differ).
5. **New message type restrictions**: v3.1 has a strict `ControlMessageReader` that crashes the entire server on unknown message types.

The solution: make **Node.js act as a TCP-to-WebSocket bridge** — no Java/Android code changes needed. The Node.js server speaks scrcpy v3.1's TCP protocol to the device and the existing ws-scrcpy WebSocket protocol to the browser.

---

## Architecture Overview

```
┌─────────────────────┐         ┌─────────────────────┐         ┌──────────────────────┐
│   Android Device    │         │      Node.js        │         │      Browser         │
│                     │   TCP   │                     │   WS    │                      │
│  scrcpy-server 3.1  │         │  ScrcpyTcpProxy     │         │  StreamReceiver      │
│  ┌───────────────┐  │────────►│  ┌───────────────┐  │────────►│  ┌────────────────┐  │
│  │ Video Socket  │  │  H.264  │  │ Strip 12-byte │  │  raw    │  │ emit('video')  │──►  BasePlayer
│  │ (TCP)         │  │  frames │  │ frame headers │  │  NALUs  │  │                │  │
│  └───────────────┘  │         │  └───────────────┘  │         │  └────────────────┘  │
│                     │         │                     │         │                      │
│  ┌───────────────┐  │────────►│  ┌───────────────┐  │────────►│  ┌────────────────┐  │
│  │ Audio Socket  │  │  Opus   │  │ Strip headers │  │ tagged  │  │ emit('audio')  │──►  AudioPlayer
│  │ (TCP)         │  │  frames │  │ + add magic   │  │ packets │  │                │  │  (WebCodecs)
│  └───────────────┘  │         │  └───────────────┘  │         │  └────────────────┘  │
│                     │         │                     │         │                      │
│  ┌───────────────┐  │◄────────│  ┌───────────────┐  │◄────────│  ┌────────────────┐  │
│  │ Control Socket│  │  touch/ │  │ Filter types  │  │  binary │  │ sendMessage()  │◄──  TouchHandler
│  │ (TCP)         │  │  key    │  │ >17, forward  │  │  msgs   │  │                │  │
│  └───────────────┘  │         │  └───────────────┘  │         │  └────────────────┘  │
└─────────────────────┘         └─────────────────────┘         └──────────────────────┘
```

### Key Design Decisions

- **Node.js is the protocol translator**: It speaks scrcpy v3.1 TCP to the device and the existing ws-scrcpy WebSocket protocol to the browser. This means the browser-side code required minimal changes.
- **Audio packets are tagged with a magic prefix**: Audio data is prefixed with `scrcpy_audio\0\0\0` (15 bytes) so `StreamReceiver` can dispatch them to the `'audio'` event without structural changes. The 15-byte length is deliberately different from the 14-byte `scrcpy_initial` magic to avoid collisions.
- **No Java/Android development**: Only TypeScript changes + swapping the JAR binary.
- **Control socket error isolation**: Control socket failures don't tear down the video/audio pipeline, because some devices (e.g. Xiaomi) throw SecurityException on INJECT_EVENTS.

---

## scrcpy v3.1 Protocol

### Server Launch

```bash
CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process / \
  com.genymobile.scrcpy.Server 3.1 \
  scid=0 log_level=error audio=true audio_codec=opus audio_bit_rate=128000 \
  tunnel_forward=true max_size=1920 control=true 2>&1
```

- `scid=0` → abstract socket name is `scrcpy_00000000`
- `tunnel_forward=true` → client connects TO device (not reverse)
- Arguments are `key=value` pairs (not positional like v1.19)

### ADB Forwarding

```
adb forward localabstract:scrcpy_00000000 tcp:<local_port>
```

Node.js opens 3 sequential TCP connections to `<local_port>`:

### Connection 1: Video Socket

```
Read: [1 byte dummy] [64 bytes device_name] [4 bytes codec_id] [4 bytes width] [4 bytes height]
Then: stream of frames, each prefixed with a 12-byte header
```

- `codec_id`: `0x68323634` = 'h264', `0x68323635` = 'h265', `0x00617631` = 'av1'
- First frame is always a config packet (SPS/PPS for H.264)

### Connection 2: Audio Socket

```
Read: [4 bytes codec_id_or_status]
Then: stream of frames, each prefixed with a 12-byte header
```

- `0x00000000` = audio disabled/not available
- `0x00000001` = audio initialisation failed on device
- `0x6f707573` = Opus codec
- `0x00616163` = AAC codec

### Connection 3: Control Socket

```
Bidirectional binary messages (touch, key, scroll, text, etc.)
```

### Frame Header Format (12 bytes, both video and audio)

```
[8 bytes] flags + PTS
          bit 63 = IS_CONFIG (codec configuration data, e.g. SPS/PPS)
          bit 62 = KEY_FRAME
          bits 0-61 = PTS in microseconds
[4 bytes] packet_size (uint32 big-endian)
```

Then `packet_size` bytes of payload data follow.

---

## Implementation Changes

### Step 1: Replace scrcpy-server Binary

**What**: Download the official `scrcpy-server` v3.1 binary from [Genymobile/scrcpy releases](https://github.com/Genymobile/scrcpy/releases) and replace the custom JAR.

**Files**:
- `vendor/Genymobile/scrcpy/scrcpy-server.jar` — replaced with official v3.1

### Step 2: Update Server Launch Arguments

**Problem**: The old v1.19-ws6 used positional arguments and custom constants like `SERVER_PORT`, `SERVER_TYPE`, `LOG_LEVEL`. scrcpy v3.1 uses `key=value` argument format.

**Solution**: Rewrote `Constants.ts` with v3.1 argument format.

**File**: `src/common/Constants.ts`

```typescript
export const SERVER_PACKAGE = 'com.genymobile.scrcpy.Server';
export const SERVER_VERSION = '3.1';
export const SCRCPY_SOCKET_NAME = 'scrcpy_00000000';

const ARGUMENTS = [
    SERVER_VERSION,
    'scid=0',
    'log_level=error',
    'audio=true',
    'audio_codec=opus',
    'audio_bit_rate=128000',
    'tunnel_forward=true',
    'max_size=1920',
    'control=true',
];

export const SERVER_PROCESS_NAME = 'app_process';
export const ARGS_STRING = `/ ${SERVER_PACKAGE} ${ARGUMENTS.join(' ')} 2>&1`;
```

**Key changes**:
- `SERVER_VERSION` updated from `'1.19-ws6'` to `'3.1'`
- Arguments switched from positional to `key=value` format
- Added `audio=true`, `audio_codec=opus`, `audio_bit_rate=128000`
- Added `tunnel_forward=true` (client connects to device)
- Added `SCRCPY_SOCKET_NAME` constant for the abstract socket name
- Removed old constants: `SERVER_TYPE`, `LOG_LEVEL`, `SERVER_PORT`, `SCRCPY_LISTENS_ON_ALL_INTERFACES`

### Step 3: Create ScrcpyTcpProxy (TCP-to-WebSocket Bridge)

**Problem**: The old v1.19-ws6 JAR spoke WebSocket directly. scrcpy v3.1 speaks raw TCP. We needed a bridge between the two.

**Solution**: Created `ScrcpyTcpProxy`, a new middleware class that:
1. ADB-forwards the scrcpy abstract socket to a local TCP port
2. Opens 3 sequential TCP connections (video, audio, control)
3. Reads the scrcpy v3.1 handshake on each socket
4. Translates between TCP frames and WebSocket messages

**File**: `src/server/goog-device/mw/ScrcpyTcpProxy.ts` (new file)

**Key implementation details**:

#### TCP Connection Sequence
```typescript
this.videoSocket = await this.connectTcp(port);   // Connection 1
this.audioSocket = await this.connectTcp(port);   // Connection 2
this.controlSocket = await this.connectTcp(port); // Connection 3
```
Order matters — scrcpy expects video first, then audio, then control.

#### Video Handshake
Reads the 1-byte dummy + 64-byte device name + 12-byte codec metadata (codec_id + width + height), then builds a `scrcpy_initial` binary message that `StreamReceiver` expects. This maintains backward compatibility with existing browser-side players.

#### Audio Streaming
Reads the 4-byte codec ID, then pipes frames. Each audio frame is:
- Stripped of its 12-byte scrcpy header
- Prefixed with `scrcpy_audio\0\0\0` magic (15 bytes) + 1 byte config flag
- Sent over WebSocket to the browser

#### Control Message Filtering
Messages from the browser are forwarded to the control TCP socket, but ws-scrcpy custom types (101 = video settings change, 102 = file push) are **filtered out** because they would cause a `ControlProtocolException` in scrcpy v3.1:

```typescript
const msgType = buf[0];
if (msgType > 17) return;  // scrcpy v3.1 only knows types 0-17
this.controlSocket.write(buf);
```

#### Control Socket Error Isolation
Control socket errors do NOT tear down video/audio:
```typescript
this.controlSocket.once('error', (e) => {
    console.warn(TAG, 'control socket error (controls disabled):', e.message);
    this.controlSocket?.destroy();
    this.controlSocket = undefined;
});
```

#### Reading Exact Bytes from TCP
A critical implementation detail: uses Node.js `readable` events with `socket.read(n)` (paused mode) for handshake reads to avoid losing bytes to race conditions:

```typescript
private readExact(socket: net.Socket, n: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let received = 0;
        const tryRead = () => {
            while (received < n) {
                const chunk = socket.read(n - received) as Buffer | null;
                if (chunk === null) return; // wait for next 'readable'
                chunks.push(chunk);
                received += chunk.length;
            }
            socket.removeListener('readable', tryRead);
            resolve(Buffer.concat(chunks, n));
        };
        socket.on('readable', tryRead);
        tryRead(); // try immediately in case data is buffered
    });
}
```

Once handshake is complete, switches to `data` events (flowing mode) for efficient frame piping.

### Step 4: Update StreamReceiver (Browser-Side Packet Dispatch)

**Problem**: `StreamReceiver` only knew about video packets and `scrcpy_initial` messages. It needed to recognize and dispatch audio packets.

**Solution**: Added audio magic detection in `onSocketMessage()`.

**File**: `src/app/client/StreamReceiver.ts`

**Changes**:
1. Added `MAGIC_BYTES_AUDIO` constant (15 bytes: `scrcpy_audio\0\0\0`)
2. Added `audio: Uint8Array` to the `StreamReceiverEvents` interface
3. Added audio magic check in `onSocketMessage()` before the video fallthrough:

```typescript
// Check MAGIC_BYTES_AUDIO (15 bytes): payload starts after the magic
if (byteLength > MAGIC_BYTES_AUDIO.length) {
    const audioMagic = new Uint8Array(event.data, 0, MAGIC_BYTES_AUDIO.length);
    if (StreamReceiver.EqualArrays(audioMagic, MAGIC_BYTES_AUDIO)) {
        this.emit('audio', new Uint8Array(event.data, MAGIC_BYTES_AUDIO.length));
        return;
    }
}
```

The 15-byte audio magic is checked separately from the 14-byte initial/message magics to avoid false matches.

### Step 5: Create AudioPlayer (Opus Decoding + Playback)

**Problem**: We needed to decode Opus audio frames in the browser and play them with minimal latency.

**Solution**: Created `AudioPlayer` using the **WebCodecs `AudioDecoder` API** (Chrome/Edge 94+, Safari 16.4+).

**File**: `src/app/player/AudioPlayer.ts` (new file)

**Audio packet format** (from StreamReceiver after stripping the magic prefix):
```
byte[0]  : 0x01 = codec config packet, 0x00 = data packet
byte[1…] : raw Opus frame data
```

**Key design decisions and fixes**:

#### 1. AudioContext Created Eagerly (Startup Delay Fix)

**Problem**: Initially, the AudioContext was created lazily when the first audio config packet arrived. Due to browser autoplay policy, the AudioContext starts in "suspended" state and can only be resumed during a user gesture call stack. By the time the first audio packet arrived (seconds later), the user gesture was long gone, causing a 10-15 second delay.

**Fix**: Create the AudioContext immediately in the constructor, which runs during the "Configure stream" button click (a user gesture):

```typescript
constructor() {
    this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
    if (this.audioCtx.state === 'running') {
        this.playing = true;
    } else {
        this.audioCtx.addEventListener('statechange', () => {
            if (this.audioCtx.state === 'running' && !this.playing && !this.stopped) {
                this.playing = true;
                if (this.pendingDescription !== undefined) {
                    this.setupDecoder(this.audioCtx, this.pendingDescription);
                }
            }
        });
        this.audioCtx.resume().catch(() => undefined);
    }
}
```

#### 2. Dropping Packets While Suspended (Audio Sync Fix)

**Problem**: While the AudioContext was suspended, decoded audio frames were being scheduled sequentially. When the context finally resumed, all accumulated frames played back-to-back, creating a 5-6 second audio delay that persisted.

**Fix**: Added a `playing` flag. Data packets are dropped while `!this.playing`:

```typescript
public pushAudioData(data: Uint8Array): void {
    if (this.stopped) return;
    const isConfig = data[0] === 1;
    if (isConfig) { this.initDecoder(payload); return; }
    if (!this.playing) return;  // drop until AudioContext is running
    // ... decode and play
}
```

#### 3. Latency Management

```typescript
const MAX_LATENCY_S = 0.10;  // 100ms max drift

private onDecodedFrame(audioData: AudioData, ctx: AudioContext): void {
    // Drop audio if drifted too far behind
    if (this.nextPlayTime < now - MAX_LATENCY_S) {
        this.nextPlayTime = now;
    }
}
```

#### 4. Mute/Unmute Support

When muted, decoded frames are discarded (no scheduling). On unmute, `nextPlayTime` resets to `currentTime` to avoid stale audio:

```typescript
public mute(): void { this.muted = true; }
public unmute(): void {
    this.muted = false;
    this.nextPlayTime = this.audioCtx.currentTime;
}
```

### Step 6: Wire Audio into StreamClientScrcpy

**Problem**: The `StreamClientScrcpy` client needed to instantiate the `AudioPlayer` and connect it to the stream.

**File**: `src/app/googDevice/client/StreamClientScrcpy.ts`

**Changes**:

```typescript
// In startStream():
if (AudioPlayer.isSupported()) {
    this.audioPlayer = new AudioPlayer();
}
streamReceiver.on('audio', this.onAudio);

// Audio handler:
public onAudio = (data: Uint8Array): void => {
    if (!this.audioPlayer) return;
    this.audioPlayer.resume().catch(() => undefined);
    this.audioPlayer.pushAudioData(data);
};

// Cleanup in onDisconnected():
this.audioPlayer?.stop();
this.audioPlayer = undefined;

// Mute control:
public setMuted(muted: boolean): void {
    if (!this.audioPlayer) return;
    if (muted) this.audioPlayer.mute();
    else this.audioPlayer.unmute();
}
```

### Step 7: Fix Control Message Formats

**Problem**: scrcpy v3.1 changed the binary format of several control messages. Sending a message with the wrong payload size corrupts scrcpy's `ControlMessageReader` buffer, causing a `ControlProtocolException` that kills the entire server (including video and audio).

#### TouchControlMessage — PAYLOAD_LENGTH: 32 → 31

**File**: `src/app/controlMessage/TouchControlMessage.ts`

scrcpy v3.1 touch format (31 bytes payload):
```
action      : 1 byte  (was also 1 byte in v1.19)
pointerId   : 8 bytes (long, was 4 bytes in v1.19)
x           : 4 bytes
y           : 4 bytes
screenWidth : 2 bytes
screenHeight: 2 bytes
pressure    : 2 bytes (unsigned short)
actionButton: 4 bytes
buttons     : 4 bytes
Total       : 31 bytes
```

The old ws-scrcpy had `PAYLOAD_LENGTH = 32`. The extra byte would shift all subsequent bytes in the control buffer, corrupting the next message and triggering `ControlProtocolException`.

**Fix**: `PAYLOAD_LENGTH = 31` and updated `toBuffer()` to write `pointerId` as 8 bytes (4 high + 4 low).

#### ScrollControlMessage — Added buttons field + fixed field sizes

**File**: `src/app/controlMessage/ScrollControlMessage.ts`

scrcpy v3.1 scroll format (20 bytes payload):
```
x           : 4 bytes
y           : 4 bytes
screenWidth : 2 bytes
screenHeight: 2 bytes
hScroll     : 2 bytes (Int16, was Int32 in some versions)
vScroll     : 2 bytes (Int16, was Int32 in some versions)
buttons     : 4 bytes (new in v3.1)
Total       : 20 bytes
```

**Fix**: `PAYLOAD_LENGTH = 20`, `hScroll`/`vScroll` as `writeInt16BE`, added 4-byte `buttons` field.

#### TextControlMessage — UTF-8 encoding bug

**File**: `src/app/controlMessage/TextControlMessage.ts`

**Problem**: Used `this.text.length` (JavaScript string length = UTF-16 code units) instead of the actual UTF-8 byte length. Non-ASCII characters (emojis, CJK, etc.) would produce a wrong length field, corrupting the message.

**Fix**: Use `Buffer.from(this.text, 'utf8').length` for the size field:

```typescript
public toBuffer(): Buffer {
    const textBytes = Buffer.from(this.text, 'utf8');
    const length = textBytes.length;  // actual UTF-8 byte count
    const buffer = Buffer.alloc(1 + TEXT_SIZE_FIELD_LENGTH + length);
    // ...
}
```

### Step 8: Add Mute/Unmute UI Control

**Problem**: Users needed a way to toggle audio on/off from the stream page.

**Solution**: Added a toggle button to the sidebar toolbar using the existing `ToolBoxCheckbox` pattern.

**Files changed**:
- `src/public/images/buttons/volume_on.svg` — new SVG icon (speaker with sound waves)
- `src/public/images/buttons/volume_off.svg` — new SVG icon (speaker with slash)
- `src/app/ui/SvgImage.ts` — added `VOLUME_ON` and `VOLUME_OFF` to `Icon` enum
- `src/app/googDevice/toolbox/GoogToolBox.ts` — added mute toggle checkbox
- `src/style/app.css` — added `cursor: pointer` to `.touch-layer` for hand cursor on hover

```typescript
// In GoogToolBox.createToolBox():
const muteToggle = new ToolBoxCheckbox(
    'Toggle audio',
    { on: SvgImage.Icon.VOLUME_ON, off: SvgImage.Icon.VOLUME_OFF },
    `mute_audio_${udid}_${playerName}`,
);
muteToggle.getElement().checked = true; // default: audio on
muteToggle.addEventListener('click', (_, el) => {
    const element = el.getElement();
    client.setMuted(!element.checked);  // checked=on → not muted
});
```

---

## Files Changed Summary

| Action   | File                                                | Purpose                                      |
|----------|-----------------------------------------------------|----------------------------------------------|
| Replace  | `vendor/Genymobile/scrcpy/scrcpy-server.jar`        | Official scrcpy v3.1 binary                  |
| Modify   | `src/common/Constants.ts`                           | v3.1 key=value arguments, socket name        |
| Modify   | `src/common/Action.ts`                              | Added `STREAM_SCRCPY_TCP` action             |
| **Create** | `src/server/goog-device/mw/ScrcpyTcpProxy.ts`    | TCP-to-WebSocket bridge (core of migration)  |
| Modify   | `src/app/client/StreamReceiver.ts`                  | Audio magic detection + event dispatch       |
| **Create** | `src/app/player/AudioPlayer.ts`                   | WebCodecs Opus decoder + Web Audio playback  |
| Modify   | `src/app/googDevice/client/StreamClientScrcpy.ts`   | AudioPlayer instantiation + mute control     |
| Modify   | `src/app/controlMessage/TouchControlMessage.ts`     | PAYLOAD_LENGTH 32→31, pointerId as 8 bytes   |
| Modify   | `src/app/controlMessage/ScrollControlMessage.ts`    | PAYLOAD_LENGTH=20, Int16 scroll, buttons     |
| Modify   | `src/app/controlMessage/TextControlMessage.ts`      | UTF-8 byte length fix                        |
| **Create** | `src/public/images/buttons/volume_on.svg`         | Mute toggle icon (on state)                  |
| **Create** | `src/public/images/buttons/volume_off.svg`        | Mute toggle icon (off state)                 |
| Modify   | `src/app/ui/SvgImage.ts`                            | VOLUME_ON/VOLUME_OFF icon enum entries        |
| Modify   | `src/app/googDevice/toolbox/GoogToolBox.ts`         | Mute toggle button in toolbar                |
| Modify   | `src/style/app.css`                                 | Pointer cursor on touch layer                |

---

## Known Limitations

1. **Android 11+ required**: Audio capture uses the `REMOTE_SUBMIX` API which is only available on Android 11 and later. Older devices will stream video normally but report `audio disabled`.

2. **WebCodecs requirement**: The `AudioPlayer` uses the `AudioDecoder` WebCodecs API, available in Chrome/Edge 94+ and Safari 16.4+. Firefox does not support WebCodecs. A WASM Opus decoder fallback is not yet implemented.

3. **Custom message types not supported**:
   - Type 101 (`TYPE_CHANGE_STREAM_PARAMETERS`): Dynamic video settings changes during streaming are silently dropped. The scrcpy server uses its initial configuration.
   - Type 102 (`TYPE_PUSH_FILE`): File/APK push via drag-and-drop is not functional with scrcpy v3.1. The file push UI remains but operations will silently fail.

4. **Browser autoplay policy**: On some browsers/configurations, audio may not start until the user interacts with the page. The AudioContext is created during the initial click, but some browsers may still require additional interaction.

5. **Device-specific control issues**: Some devices (notably Xiaomi POCO series) throw `SecurityException` on `INJECT_EVENTS` permission, preventing touch/key controls. Video and audio continue working. The control socket is isolated to prevent this from crashing the stream.

---

## Troubleshooting Guide

### Video shows first frame then freezes

**Cause**: Control messages with wrong payload sizes corrupt scrcpy's `ControlMessageReader`, causing a `ControlProtocolException` that kills the server.

**Check**: Server logs for `Controller stopped` or `ControlProtocolException`. Verify that `TouchControlMessage.PAYLOAD_LENGTH = 31` (not 32).

### Audio has 5-6 second delay

**Cause**: AudioContext is suspended, and decoded frames are being scheduled while suspended. When it resumes, all accumulated frames play sequentially.

**Fix**: Ensure `AudioPlayer.pushAudioData()` drops data packets while `!this.playing`. Config packets should still be processed to set up the decoder.

### Audio takes 10-15 seconds to start

**Cause**: AudioContext is being created lazily (on first config packet) instead of eagerly (during user click).

**Fix**: Ensure `AudioPlayer` constructor creates the AudioContext immediately, not in `initDecoder()`.

### Controls not working (stream still plays)

**Cause**: `control=false` in Constants.ts, or the device lacks INJECT_EVENTS permission, or the control socket failed silently.

**Check**: Verify `control=true` in Constants.ts. Check server logs for `SecurityException`. Try a different device.

### Server logs: "Unexpected audio codec: 0x0"

**Cause**: Device doesn't support audio capture (Android < 11, or audio permission not granted).

**Action**: Normal — video will still work. Audio is simply not available on this device.

### Server exits immediately with no output

**Cause**: Mismatched server version string. `ScrcpyServer.getServerPid()` checks the cmdline for the version string and kills mismatched processes.

**Fix**: Ensure `SERVER_VERSION` in Constants.ts matches the actual JAR version exactly (e.g., `'3.1'`).
