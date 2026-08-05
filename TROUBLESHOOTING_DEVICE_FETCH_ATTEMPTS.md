# Troubleshooting: "Maximum number of attempts to fetch device info has been reached"

## Symptoms

Typical symptoms include:

-   Terminal output from `ws-scrcpy`:

    ```text
    [H3XDU17B03012465] The maximum number of attempts to fetch device info has been reached.
    ```

-   The initial device stream loads successfully through the reverse proxy.
-   Refreshing the browser page (`F5`) causes:
    -   an infinite loading screen
    -   a black video area
    -   no successful reconnection
-   Waiting several minutes eventually allows new connections to succeed again.

---

# Root Cause Analysis

This behavior is typically caused by **scrcpy-server process lifecycle locks** combined with **ADB TCP socket teardown latency**.

When a browser connects to a device stream, `ws-scrcpy` performs the following sequence:

1. Pushes `scrcpy-server.jar` to the Android device.
2. Starts the server process via `adb shell`, creating a local abstract socket:

    ```text
    localabstract:scrcpy
    ```

3. Creates an ADB port forward on the host:

    ```text
    adb forward tcp:8886 localabstract:scrcpy
    ```

4. Starts a background tracker that continuously retrieves:

    - screen resolution
    - orientation
    - supported video decoders
    - device metadata

---

# Why Refreshing (`F5`) Causes a Hang

A page refresh disconnects the WebSocket almost instantly.

If the backend does not immediately terminate the running `scrcpy-server` process, several issues can occur.

## Abrupt Disconnect

The browser closes the WebSocket before the backend has fully cleaned up the device session.

---

## Zombie `scrcpy-server` Process

If the backend fails to terminate the remote process, or if the socket remains in the operating system's `TIME_WAIT` state, the forwarded local port (for example, `8886`) remains unavailable.

---

## Rebind Conflict

Immediately after the refresh, `ws-scrcpy` attempts to:

-   start a new `scrcpy-server`
-   recreate the ADB forward
-   query device metadata

Because the previous socket is still held by the terminating process, initialization blocks until `DeviceTracker` eventually reaches its retry limit.

---

## Why Waiting Eventually Fixes It

After a timeout:

-   Android cleans up the abandoned abstract socket, or
-   `ws-scrcpy`'s cleanup routines terminate the orphaned server process.

Once the stale resources have been released, new connections can be established successfully.

---

# Remediation Steps

## 1. Manual Cleanup (Development)

To immediately clear stale ADB forwards and orphaned `scrcpy-server` instances:

```bash
# Remove all forwarded ADB ports
adb forward --remove-all

# Kill orphaned scrcpy-server processes on the device
adb -s <DEVICE_UDID> shell pkill -f scrcpy
```

---

## 2. Reverse Proxy Configuration (Traefik)

Ensure that long-lived WebSocket connections are not prematurely terminated due to proxy buffering or idle timeouts.

For Traefik, configure response flushing:

```yaml
labels:
    - 'traefik.http.services.scrcpy.loadbalancer.responseForwarding.flushInterval=100ms'
```

---

## 3. Backend Lifecycle Patch (`ws-scrcpy`)

Ensure that the backend explicitly terminates the device-side `scrcpy-server` whenever a client disconnects.

For example, inside:

```text
src/server/goog-device/ServerTracker.ts
```

or

```text
src/server/goog-device/ControlCenter.ts
```

the WebSocket close handler should invoke cleanup logic such as:

```ts
ws.on('close', () => {
    scrcpyServer.stop();
});
```

or explicitly terminate the associated ADB shell process (for example, by sending `SIGTERM`).

Proper cleanup prevents orphaned `scrcpy-server` instances from retaining ADB socket locks and allows immediate reconnection after a browser refresh.
