# ws-scrcpy Configuration & Build Optimization Guide

This document outlines the recommended configuration strategy for running **ws-scrcpy** in a production environment behind a reverse proxy (such as Traefik or Nginx) alongside an Allocation Backend.

---

# 1. Runtime Configuration (`config.yaml`)

`ws-scrcpy` includes a `config.example.yaml` file in the project root. Create a `config.yaml` file to define the runtime configuration.

## Minimal Production Configuration

```yaml
# Track only Android devices (disables iOS usbmuxd polling)
runGoogTracker: true
runApplTracker: false

# HTTP Server Configuration
server:
    - secure: false
      port: 8000
```

## Key Considerations

### `runGoogTracker: true` (**Mandatory**)

Enables real-time Android device tracking via `adb track-devices`.

The tracker:

-   Detects device connection/disconnection events
-   Detects state changes (`device`, `unauthorized`, `offline`)
-   Supports hot-plugging
-   Automatically cleans up ADB TCP forwards when devices disconnect

> **Important:** Disabling this prevents `ws-scrcpy` from discovering connected Android devices.

---

### `runApplTracker: false`

Disables iOS `usbmuxd` polling.

If your platform supports only Android devices, disabling this:

-   reduces CPU usage
-   avoids unnecessary background polling
-   decreases log noise

---

### `remoteHostList`

Only configure this when running a **distributed device farm**, where Android devices are attached to multiple physical host machines.

If all devices are connected to the same server, omit this section entirely.

---

### `server`

```yaml
server:
    - secure: false
      port: 8000
```

Since TLS termination and HTTP → HTTPS redirection are handled by the reverse proxy (Traefik, Nginx, etc.), `ws-scrcpy` should expose only a plain HTTP service internally.

---

# 2. Build-Time Configuration (`build.config.override.json`)

Build options determine which frontend features and backend components are compiled into the application.

Instead of modifying:

```text
webpack/default.build.config.json
```

create a file named:

```text
build.config.override.json
```

Webpack automatically merges this file during:

```bash
npm run build
```

## Recommended Production Configuration

```json
{
    "SCRCPY_LISTENS_ON_ALL_INTERFACES": false,
    "INCLUDE_DEV_TOOLS": false,
    "INCLUDE_ADB_SHELL": false,
    "INCLUDE_FILE_LISTING": false,
    "USE_QVH_SERVER": false,
    "INCLUDE_APPL": false,
    "INCLUDE_GOOG": true,
    "USE_WEBCODECS": true,
    "USE_BROADWAY": true,
    "USE_TINY_H264": true
}
```

---

# Critical Security & Performance Tweaks

## `SCRCPY_LISTENS_ON_ALL_INTERFACES: false` (**Critical Security Setting**)

**Default**

```json
true
```

This binds ADB TCP forwards to:

```text
0.0.0.0
```

**Recommended Production Setting**

```json
false
```

This binds ADB TCP forwards only to:

```text
127.0.0.1
```

### Why this matters

If this setting remains `true`, anyone capable of reaching the host machine can potentially connect directly to forwarded ports (for example `8886`), bypassing:

-   reverse proxy routing
-   authentication
-   authorization
-   access tokens

Setting it to `false` ensures that only the local Node.js backend can access forwarded ADB sockets.

---

## UI Feature Hardening

### `INCLUDE_ADB_SHELL: false`

Disables the browser-based interactive terminal.

Without this, users cannot execute arbitrary:

```bash
adb shell
```

commands on connected devices.

---

### `INCLUDE_FILE_LISTING: false`

Disables the browser file manager.

This prevents unauthorized browsing or downloading of files from locations such as:

```text
/sdcard/
```

---

### `INCLUDE_DEV_TOOLS: false`

Removes internal debugging panels from the production build.

Benefits include:

-   smaller frontend bundle
-   reduced attack surface
-   cleaner user interface

---

## Subsystem Optimization

### `USE_QVH_SERVER: false`

Disables compilation of QuickTime Video Hack (QVH), which is only required for iOS capture.

---

### `INCLUDE_APPL: false`

Excludes all iOS-specific functionality from the build.

---

## Video Decoder Support

Keep the following enabled:

```json
{
    "USE_WEBCODECS": true,
    "USE_BROADWAY": true,
    "USE_TINY_H264": true
}
```

This allows the frontend player to fall back between multiple decoding implementations depending on browser capabilities.

Typical fallback order:

1. WebCodecs (hardware accelerated, when available)
2. Broadway
3. TinyH264
