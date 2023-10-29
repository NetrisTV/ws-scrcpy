import { MsePlayer } from './MsePlayer';
import Size from '../Size';
import VideoSettings from '../VideoSettings';
import { DisplayInfo } from '../DisplayInfo';
import defaultVideoSettings from './defaultVideoSettings.json';

export class MsePlayerForQVHack extends MsePlayer {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: defaultVideoSettings.lockedVideoOrientation,
        bitrate: defaultVideoSettings.bitrate,
        maxFps: defaultVideoSettings.maxFps,
        iFrameInterval: defaultVideoSettings.iFrameInterval,
        bounds: new Size(defaultVideoSettings.bounds.width, defaultVideoSettings.bounds.height),
        sendFrameMeta: defaultVideoSettings.sendFrameMeta,
    });

    public readonly resizeVideoToBounds: boolean = true;
    constructor(
        udid: string,
        displayInfo?: DisplayInfo,
        name = 'MSE_Player_For_QVHack',
        tag = MsePlayerForQVHack.createElement(),
    ) {
        super(udid, displayInfo, name, tag);
    }

    protected needScreenInfoBeforePlay(): boolean {
        return false;
    }

    public getPreferredVideoSetting(): VideoSettings {
        return MsePlayerForQVHack.preferredVideoSettings;
    }

    public setVideoSettings(): void {
        return;
    }
}
