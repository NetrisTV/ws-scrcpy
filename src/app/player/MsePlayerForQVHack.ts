import { MsePlayer } from './MsePlayer';
import Size from '../Size';
import VideoSettings from '../VideoSettings';
import { DisplayInfo } from '../DisplayInfo';

export class MsePlayerForQVHack extends MsePlayer {
    public static readonly preferredVideoSettings: VideoSettings = new VideoSettings({
        lockedVideoOrientation: -1,
        bitrate: 8000000,
        maxFps: 30,
        iFrameInterval: 10,
        bounds: new Size(720, 720),
        sendFrameMeta: false,
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
