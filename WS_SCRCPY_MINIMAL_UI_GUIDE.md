# ws-scrcpy Integration

> Living document.
>
> Every engineer or AI agent modifying the ws-scrcpy fork must update this document.
>
> This repository intentionally minimizes divergence from upstream.

---

# Purpose

ws-scrcpy provides

-   Android video streaming
-   touch interaction
-   keyboard input
-   clipboard synchronization
-   scrcpy protocol implementation

It does **not** perform authentication.

---

# Current Architecture

The project consists of

-   protocol layer
-   decoder layer
-   player layer
-   UI layer

Only the UI layer has been customized.

---

# Local Modifications

Current upstream additions

## Minimal Frontend

New entrypoint

```
minimal.html
```

Purpose

Render only

-   phone
-   video
-   touch
-   keyboard

without

-   toolbars
-   sidebars
-   debug UI
-   shell
-   settings

---

## Shared Player Registration

Player registration moved into

```
registerPlayers.ts
```

Shared by

-   index.ts
-   minimal.ts

---

## StreamClientScrcpy

Supports optional startup mode

```
includeDeviceControls
```

Default

```
true
```

Minimal frontend

```
false
```

---

# Authentication

Authentication is external.

ws-scrcpy never validates users.

It trusts Traefik.

---

# Stream URLs

Typical production URL

```
/minimal.html#!action=stream...
```

Authentication handled by

HTTP-only cookie

issued before arriving at ws-scrcpy.

---

# Fork Policy

This repository is intentionally maintained as a minimal fork.

Allowed changes

-   new entrypoints
-   integration hooks
-   small extension points

Avoid

-   protocol modifications
-   decoder modifications
-   upstream architecture rewrites

Whenever possible

extend

do not replace.

---

# Upgrade Policy

When upstream releases new versions

1. merge upstream
2. resolve conflicts
3. verify minimal frontend
4. update this document

---

# Future Changes

Update this document whenever modifying

-   frontend
-   player initialization
-   touch handling
-   keyboard handling
-   protocol
-   build
-   webpack
-   decoder registration
