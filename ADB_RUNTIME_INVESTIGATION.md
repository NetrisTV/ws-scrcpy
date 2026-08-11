# ws-scrcpy ADB Runtime Investigation

Date: 2026-08-11

## Executive Summary

ws-scrcpy uses the Node library `@dead50f7/adbkit`, resolved by `pnpm-lock.yaml` to version `2.11.5`.

The Node ADB path is configured for the host ADB server:

```text
172.20.0.1:5037
```

Device discovery, device tracking, device metadata, scrcpy JAR upload, and ADB forwarding all use this Node client and can see the host devices.

There is one important transport mismatch during scrcpy startup. The scrcpy server launch is performed through a separately spawned system command:

```text
adb -s DEVICE_ID shell <command>
```

This command does not receive `-H 172.20.0.1 -P 5037` and does not set `ADB_SERVER_SOCKET`. Inside the container it therefore uses the standard local ADB default, `localhost:5037`, where no devices are visible.

The result is a split path:

```text
Discovery and upload:
  Stream/device selection -> adbkit -> 172.20.0.1:5037 -> host ADB -> device

Scrcpy launch:
  ScrcpyServer -> spawn("adb", ["-s", udid, "shell", ...])
              -> container-local ADB -> no device
```

## ADB Library and Configuration

The dependency is declared in [package.json](package.json) and resolved as `@dead50f7/adbkit@2.11.5` in [pnpm-lock.yaml](pnpm-lock.yaml).

The custom factory is [src/server/goog-device/adb/index.ts](src/server/goog-device/adb/index.ts), in `AdbExtended.createClient()`:

```ts
const opts: ClientOptions = {
    bin: options.bin,
    host: options.host || process.env.ADB_HOST || '172.20.0.1',
    port: options.port || 0,
};
```

When no explicit port is supplied, the same method reads `process.env.ADB_PORT`; if it is absent or invalid, it uses `5037`.

With the verified container environment:

```text
ADB_HOST=172.20.0.1
ADB_PORT=5037
```

all clients created through `AdbExtended.createClient()` connect to `172.20.0.1:5037`.

The upstream adbkit default is localhost:5037 when no host is supplied. ws-scrcpy overrides that fallback to `172.20.0.1` in its wrapper.

Environment variable usage in source:

| Variable | Consumed by ws-scrcpy source? | Effect |
| --- | --- | --- |
| `ADB_HOST` | Yes | Host for Node adbkit clients |
| `ADB_PORT` | Yes | Port for Node adbkit clients |
| `ADB_CONNECTIVITY_TIMEOUT_MS` | No | No effect found |
| `ADB_SERVER_SOCKET` | No | No effect found in source |

`ADB_HOST` and `ADB_PORT` are not automatically passed to a separately spawned `adb` process merely because they exist in the environment. The standard adb CLI does not use arbitrary variables with those names.

## Production Execution Path

### Minimal frontend

[src/app/minimal.ts](src/app/minimal.ts) performs the following startup:

1. Loads the application stylesheet.
2. Imports `StreamClientScrcpy`.
3. Calls `registerAvailablePlayers(StreamClientScrcpy)`.
4. Parses the URL hash.
5. Parses stream parameters, enables keyboard capture by default when unspecified, and calls `StreamClientScrcpy.start()` with `includeDeviceControls: false`.

The original [src/app/index.ts](src/app/index.ts) also calls `registerAvailablePlayers(StreamClientScrcpy)` before starting a stream. The minimal entrypoint changes only frontend behavior. It does not own or configure ADB.

### Stream client and player

[src/app/googDevice/client/StreamClientScrcpy.ts](src/app/googDevice/client/StreamClientScrcpy.ts) constructs a `StreamReceiverScrcpy` when no receiver is supplied, creates the selected player from the registered player classes, attaches the player to the page, and starts receiving video through the receiver.

`registerAvailablePlayers()` in [src/app/registerPlayers.ts](src/app/registerPlayers.ts) is sufficient for player registration. No original server or ADB initialization step is missing from `minimal.ts`.

### Server startup and device manager

[src/server/index.ts](src/server/index.ts) dynamically loads the Android modules. It registers:

- `ControlCenter` as a service;
- Android `DeviceTracker` as a WebSocket/multiplexer handler when configured;
- `WebsocketProxyOverAdb` for ADB-backed WebSocket proxying.

`ControlCenter` is implemented in [src/server/goog-device/services/ControlCenter.ts](src/server/goog-device/services/ControlCenter.ts). It creates a Node ADB client with:

```ts
private client: AdbKitClient = AdbExtended.createClient();
```

Its initialization performs:

```ts
this.client.trackDevices();
this.client.listDevices();
```

Both operations use the configured adbkit endpoint, `172.20.0.1:5037`.

For every discovered device, `ControlCenter.handleConnected()` creates:

```ts
new Device(udid, state)
```

The selected ADB serial is preserved as `Device.udid`.

## Selected Device and ADB Transport

The `Device` constructor in [src/server/goog-device/Device.ts](src/server/goog-device/Device.ts) creates another adbkit client through the same factory:

```ts
this.client = AdbExtended.createClient();
```

Node-based device operations pass the selected serial to adbkit:

```ts
this.client.shell(this.udid, command)
this.client.push(this.udid, contents, path)
this.client.getProperties(this.udid)
```

Therefore discovery and Node operations use the same configured ADB server and the same selected `udid` transport.

## Scrcpy Server Startup

Scrcpy startup is implemented in [src/server/goog-device/ScrcpyServer.ts](src/server/goog-device/ScrcpyServer.ts).

The sequence is:

1. Check whether a compatible scrcpy `app_process` is already running.
2. Push `scrcpy-server.jar` to `/data/local/tmp/scrcpy-server.jar` using `device.push()`.
3. Launch the Android server.
4. Poll the device for the server PID.

The JAR upload uses adbkit:

```ts
return device.push(src, dst);
```

The launch does not use adbkit. It calls:

```ts
const runPromise = device.runShellCommandAdb(RUN_COMMAND);
```

`Device.runShellCommandAdb()` in [src/server/goog-device/Device.ts](src/server/goog-device/Device.ts) spawns the system executable:

```ts
const cmd = 'adb';
const args = ['-s', `${this.udid}`, 'shell', command];
const adb = spawn(cmd, args, ...);
```

This is the only relevant child-process ADB invocation in the scrcpy path. It does not add `-H`, `-P`, or an explicit ADB socket environment variable.

The command assembled by [src/common/Constants.ts](src/common/Constants.ts) is equivalent to:

```text
CLASSPATH=/data/local/tmp/scrcpy-server.jar nohup app_process / \
com.genymobile.scrcpy.Server 1.19-ws7 web ERROR 8886 false \
2>&1 > /dev/null
```

The server listens on device TCP port `8886`.

## WebSocket Path

The browser-side receiver is [src/app/googDevice/client/StreamReceiverScrcpy.ts](src/app/googDevice/client/StreamReceiverScrcpy.ts). It builds its WebSocket URL from the `ws` stream parameter. For a non-multiplexed connection, `StreamReceiver` adds the selected `udid` to the URL.

The normal device-list route uses the ADB proxy option. [src/app/googDevice/client/DeviceTracker.ts](src/app/googDevice/client/DeviceTracker.ts) creates a URL with:

```text
action=proxy-adb
remote=tcp:8886
udid=DEVICE_ID
```

The server-side [src/server/services/WebSocketServer.ts](src/server/services/WebSocketServer.ts) attaches to the HTTP server and dispatches WebSocket requests to middleware.

[src/server/goog-device/mw/WebsocketProxyOverAdb.ts](src/server/goog-device/mw/WebsocketProxyOverAdb.ts) handles `proxy-adb` requests and calls:

```ts
AdbUtils.forward(udid, remote)
```

`AdbUtils.forward()` creates an adbkit client and calls `client.forward(serial, local, remote)`. This forwarding operation again uses `172.20.0.1:5037` and the selected serial. The proxy then connects to the local forwarded port and relays the WebSocket traffic.

When direct device-interface links are enabled, the browser can instead connect directly to the device interface on port `8886`. The default proxy route still uses adbkit forwarding.

## Native scrcpy Comparison

Native host execution:

```text
scrcpy -s DEVICE_ID
```

uses the host ADB environment and reaches the host ADB server that sees the USB devices.

ws-scrcpy uses two different mechanisms:

- Node adbkit operations: `172.20.0.1:5037`;
- scrcpy launch subprocess: bare `adb` inside the container, defaulting to `localhost:5037`.

Therefore native `scrcpy -s DEVICE_ID` and the ws-scrcpy scrcpy launch do not currently use the same ADB transport.

## Failure Behavior When the Device Is Missing From the Spawned ADB Client

The device can be visible to `ControlCenter` because adbkit reaches `172.20.0.1:5037`. The `Device` object is then created with the correct serial, and the JAR push can succeed through adbkit.

The subsequent spawned command:

```text
adb -s DEVICE_ID shell ...
```

runs against the container-local ADB server. Since that server has no devices, the command cannot start the scrcpy server for the selected serial.

`runShellCommandAdb()` logs stderr and resolves on process close without explicitly rejecting for a nonzero exit code. The surrounding startup logic then checks for the scrcpy process through adbkit. Since the process was not started, the device remains without a valid scrcpy PID and update attempts continue.

## Conclusions

1. ws-scrcpy uses `@dead50f7/adbkit` 2.11.5 for its primary ADB operations.
2. The Node client connects to `172.20.0.1:5037` with the verified environment.
3. `ADB_HOST` and `ADB_PORT` affect Node adbkit clients through `AdbExtended.createClient()`.
4. `ADB_CONNECTIVITY_TIMEOUT_MS` and `ADB_SERVER_SOCKET` are not consumed by ws-scrcpy source.
5. There is no ADB endpoint object passed from `Config` into `ControlCenter`; the factory reads the process environment directly.
6. Discovery, device metadata, JAR upload, and ADB forwarding use the Node endpoint and selected serial.
7. Scrcpy launch uses a separate bare system `adb` subprocess and defaults to localhost inside the container.
8. This creates the confirmed configuration mismatch responsible for devices being discoverable through explicit host ADB access but unavailable to the scrcpy launch command.
9. The minimal frontend initialization is not the cause of the mismatch.

## Next Runtime Boundary

The next exact boundary to instrument is:

```text
ScrcpyServer.run()
  -> Device.runShellCommandAdb()
  -> spawn('adb', ['-s', udid, 'shell', ...])
```

The most useful values at that boundary are the selected `udid`, child-process environment, actual ADB socket selection, stderr, and exit code.