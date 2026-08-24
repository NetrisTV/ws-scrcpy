# Using Docker without ADB over IP
Some Scenarios prefer or require not having the phone we want to control on the same network as the ws-scrcpy server.
## Requirements:
- ADB-Server running on a system with usb connection to the target android device(s) - IP: ANDROID_ADB_SERVER_ADDRESS
- Docker image running ws-scrpcy must have tcp connection to the ADB-Server
- Client using Web-Browser to control the phones must be able to connect to the ADB-Server via websocket, ip "exposed" to the client: - IP: HOST_IP_ADDRESS
    - the ADB-Server will forward the websocket directly to the phone, but not via tcp as per the usual ws-scrpy setup, but via USB.

## scheme overview

The diagram below shows the documented setup: the ADB server runs on the host (has the USB-connected Android device), the ws-scrcpy server runs inside a Docker container and connects to the host ADB server using `host.docker.internal` (configured via `ANDROID_ADB_SERVER_ADDRESS`). The browser client connects to the ws-scrcpy HTTP/WS endpoint exposed by Docker (host port mapped to container port).

```
                                         +---------------------------------------+
                                         |  Browser (Client)                     |
                                         |  - connects to webif                  |
                                         |  - opens WS to android via adb-server |
                                         +-----------+---------------------------+
                                                     |
                                                     | HTTP / WS
                                                     |
    Host machine (runs ADB server)         <-------- + --------> Docker container (ws-scrcpy)
  +-----------------------------------+              |    +------------------------------------+
  | Android device (USB)              |              |    | ws-scrcpy webapp (Node.js)         |
  |  - ws-scrcpy server/listener      |              |    |  - HTTP server (8000)              |
  +----------------+------------------+              |    |  - uses ANDROID_ADB_SERVER_ADDRESS |
                  USB                                |    |    (host.docker.internal)          |
                                                     |    |  - configures adb-server to        |
  (adb daemon, listens on 127.0.0.1:5037)            |    |    forward ws to android device    |
                                                     |    +------------+-----------------------+
                                                     |                 |
                                                     |                 | TCP websocket
                                                     |                 | (to forwarded port)
                                                     |                 v
  (adb forward) host tcp:7001  <--------->  android-device: running ws-scrcpy server/listener

Notes:
- Set ANDROID_ADB_SERVER_ADDRESS=host.docker.internal in the container so the app connects to the host ADB server.
- The container uses adb-forwarded host ports (ADB_FORWARD_PORT_START) to reach device devtools sockets.
- Clients connect to the ws-scrcpy HTTP/WS endpoint exposed by Docker (HOST_IP_ADDRESS should be reachable by the client browser).
```

## systemd adb example
- add user:
`sudo useradd --system --home /var/lib/adb --shell /usr/sbin/nologin --groups plugdev adb`
- systemd service 
`/etc/systemd/system/adb.service`
```
[Unit]
Description=Android Debug Bridge Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/adb -a nodaemon server start
Restart=always
RestartSec=5
User=adb

[Install]
WantedBy=multi-user.target
```

## docker-compose example
TODO: update/switch/add Dockerfile
```
services:
  ws-scrcpy:
    build: .
    image: local/ws-scrcpy
    volumes:
      - ./ws-scrcpy/:/app
    ports:
      - 8001:8000

    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      # ip of host running adb for webclients:
      HOST_IP_ADDRESS: "host_ip_of_adb-server-reachable-by-user-accessing-ws-scrcpy"
      # address of adb server from this container:
      ANDROID_ADB_SERVER_ADDRESS: "host.docker.internal"
      ADB_FORWARD_PORT_START: "7000"
      ADB_HOST: "host.docker.internal"
```