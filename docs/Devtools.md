# Devtools
Forward and proxy a WebKit debug-socket from an android device to your browser

## How it works

### Server
1. Find devtools sockets: `adb shell 'grep -a devtools_remote /proc/net/unix'`
2. For each socket request `/json` and `/json/version`
3. Replace websocket address in response with our hostname
4. Combine all data and send to a client

### Client
Though each debuggable page explicitly specifies `devtoolsFrontendUrl` it is
possible that provided version of devtools frontend will not work in your
browser. To ensure that you will be able to debug webpage/webview, client
creates three links:
- `inspect` - this is a link provided by a remote browser in the answer for
`/json` request (only WebSocket address is changed). When this link points to
a local version of devtools (bundled with debuggable browser) you will not able
to open it, because only WebSocket forwarding is implemented at the moment.
- `bundled` - link to a version of devtools bundled with your (chromium based)
browser without specifying revision or version of the remote target. You will
get same link in the `chrome://inspect` page of Chromium browser.
e.g. `devtools://devtools/bundled/inspector.html?ws=<WebSocketAddress>`
- `remote` - link to a bundled devtools but with specified revision and version
of remote target. This link is visible only when original link in
`devtoolsFrontendUrl` contains revision. You will get same link in the
 `chrome://inspect` page of Chrome browser.
e.g. `devtools://devtools/remote/serve_rev/@<Revision>/inspector.html?remoteVersion=<Version>&remoteFrontend=true&ws=<WebSocketAddress>`

**You can't open two last links with click or `open link in new tab`.** 

You must copy link and open it manually. This is browser restriction.
