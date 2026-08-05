import { StreamClientScrcpy } from './googDevice/client/StreamClientScrcpy';

export async function registerAvailablePlayers(client: typeof StreamClientScrcpy): Promise<void> {
    /// #if USE_BROADWAY
    const { BroadwayPlayer } = await import('./player/BroadwayPlayer');
    client.registerPlayer(BroadwayPlayer);
    /// #endif

    /// #if USE_H264_CONVERTER
    const { MsePlayer } = await import('./player/MsePlayer');
    client.registerPlayer(MsePlayer);
    /// #endif

    /// #if USE_TINY_H264
    const { TinyH264Player } = await import('./player/TinyH264Player');
    client.registerPlayer(TinyH264Player);
    /// #endif

    /// #if USE_WEBCODECS
    const { WebCodecsPlayer } = await import('./player/WebCodecsPlayer');
    client.registerPlayer(WebCodecsPlayer);
    /// #endif
}
