import '../style/app.css';
import * as querystring from 'querystring';
import { StreamClientScrcpy } from './googDevice/client/StreamClientScrcpy';
import { HostTracker } from './client/HostTracker';
import { StreamClientQVHack } from './applDevice/client/StreamClientQVHack';
import { Tool } from './googDevice/client/Tool';

window.onload = async function (): Promise<void> {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = querystring.parse(hash);
    const action = parsedQuery.action;

    /// #if USE_WEBCODECS
    const { WebCodecsPlayer } = await import('./player/WebCodecsPlayer');
    StreamClientScrcpy.registerPlayer(WebCodecsPlayer);
    /// #endif

    /// #if USE_BROADWAY
    const { BroadwayPlayer } = await import('./player/BroadwayPlayer');
    StreamClientScrcpy.registerPlayer(BroadwayPlayer);
    /// #endif

    /// #if USE_H264_CONVERTER
    const { MsePlayer } = await import('./player/MsePlayer');
    StreamClientScrcpy.registerPlayer(MsePlayer);
    /// #endif

    /// #if USE_TINY_H264
    const { TinyH264Player } = await import('./player/TinyH264Player');
    StreamClientScrcpy.registerPlayer(TinyH264Player);
    /// #endif

    if (action === StreamClientScrcpy.ACTION && typeof parsedQuery.udid === 'string') {
        StreamClientScrcpy.start(parsedQuery);
        return;
    }
    if (action === StreamClientQVHack.ACTION && typeof parsedQuery.udid === 'string') {
        StreamClientQVHack.start(parsedQuery);
        return;
    }

    const tools: Tool[] = [];

    /// #if INCLUDE_ADB_SHELL
    const { ShellClient } = await import('./googDevice/client/ShellClient');
    if (action === ShellClient.ACTION && typeof parsedQuery.udid === 'string') {
        ShellClient.start(parsedQuery);
        return;
    }
    tools.push(ShellClient);
    /// #endif

    /// #if INCLUDE_DEV_TOOLS
    const { DevtoolsClient } = await import('./googDevice/client/DevtoolsClient');
    if (action === DevtoolsClient.ACTION) {
        DevtoolsClient.start(parsedQuery);
        return;
    }
    tools.push(DevtoolsClient);
    /// #endif

    /// #if INCLUDE_FILE_LISTING
    const { FileListingClient } = await import('./googDevice/client/FileListingClient');
    if (action === FileListingClient.ACTION) {
        FileListingClient.start(parsedQuery);
        return;
    }
    tools.push(FileListingClient);
    /// #endif

    if (tools.length) {
        const { DeviceTracker } = await import('./googDevice/client/DeviceTracker');
        tools.forEach((tool) => {
            DeviceTracker.registerTool(tool);
        });
    }
    HostTracker.start();
};
