import '../style/app.css';
import { StreamClientScrcpy } from './googDevice/client/StreamClientScrcpy';
import { registerAvailablePlayers } from './registerPlayers';

window.onload = async function (): Promise<void> {
    const hash = location.hash.replace(/^#!/, '');
    const parsedQuery = new URLSearchParams(hash);
    const action = parsedQuery.get('action');

    await registerAvailablePlayers(StreamClientScrcpy);

    if (action === StreamClientScrcpy.ACTION && typeof parsedQuery.get('udid') === 'string') {
        const params = StreamClientScrcpy.parseParameters(parsedQuery);

        // Minimal entry has no toolbox toggle, so keyboard capture is enabled by default.
        if (!parsedQuery.has('captureKeyboard')) {
            params.captureKeyboard = true;
        }

        StreamClientScrcpy.start(params, undefined, undefined, undefined, undefined, {
            includeDeviceControls: false,
        });
    }
};
