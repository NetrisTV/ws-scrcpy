import '../style/app.css';
import '../public/ws-scrcpy.webmanifest'
import '../public/icons/icon-256.png'
import { StreamClientScrcpy } from './googDevice/client/StreamClientScrcpy';
import { HostTracker } from './client/HostTracker';
import { Tool } from './client/Tool';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').then(registration => {
        console.log('SW registered: ', registration);
      }).catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
    });
  }

window.onload = async function (): Promise<void> {

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

    /// #if USE_WEBCODECS
    const { WebCodecsPlayer } = await import('./player/WebCodecsPlayer');
    StreamClientScrcpy.registerPlayer(WebCodecsPlayer);
    /// #endif

    const tools: Tool[] = [];

    /// #if INCLUDE_ADB_SHELL
    const { ShellClient } = await import('./googDevice/client/ShellClient');
    tools.push(ShellClient);
    /// #endif

    /// #if INCLUDE_DEV_TOOLS
    const { DevtoolsClient } = await import('./googDevice/client/DevtoolsClient');
    tools.push(DevtoolsClient);
    /// #endif

    /// #if INCLUDE_FILE_LISTING
    const { FileListingClient } = await import('./googDevice/client/FileListingClient');
    tools.push(FileListingClient);
    /// #endif

    if (tools.length) {
        const { DeviceTracker } = await import('./googDevice/client/DeviceTracker');
        tools.forEach((tool) => {
            DeviceTracker.registerTool(tool);
        });
    }
    HostTracker.start();

    ['hashchange','locationchange'].forEach((event) => {
        window.addEventListener(event ,async () => {
            const hash = location.hash.replace(/^#!/, '');
            const parsedQuery = new URLSearchParams(hash);
            const action = parsedQuery.get('action');
            console.log(action)
        
            if (action === StreamClientScrcpy.ACTION && typeof parsedQuery.get('udid') === 'string') {
                document.body.innerHTML = '';
                StreamClientScrcpy.start(parsedQuery);
                return;
            }
            if (action === ShellClient.ACTION && typeof parsedQuery.get('udid') === 'string') {
                document.body.innerHTML = '';
                ShellClient.start(ShellClient.parseParameters(parsedQuery));
                return;
            }
            if (action === DevtoolsClient.ACTION) {
                document.body.innerHTML = '';
                DevtoolsClient.start(DevtoolsClient.parseParameters(parsedQuery));
                return;
            }
            if (action === FileListingClient.ACTION) {
                document.body.innerHTML = '';
                FileListingClient.start(FileListingClient.parseParameters(parsedQuery));
                return;
            }

            document.body.innerHTML = '';
            if (tools.length) {
                const { DeviceTracker } = await import('./googDevice/client/DeviceTracker');
                tools.forEach((tool) => {
                    DeviceTracker.registerTool(tool);
                });
            }
            HostTracker.start();
        })
    })
};
