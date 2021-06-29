import Point from '../Point';
import Position from '../Position';
import ScreenInfo from '../ScreenInfo';
import { WsQVHackClient } from './client/WsQVHackClient';

interface WdaScreen {
    statusBarSize: { width: number; height: number };
    scale: number;
}

export default class WdaConnection {
    private screenInfo?: ScreenInfo;
    private client?: WsQVHackClient;
    private wdaScreen?: WdaScreen;

    public setScreenInfo(screenInfo: ScreenInfo): void {
        this.screenInfo = screenInfo;
    }

    public getScreenInfo(): ScreenInfo | undefined {
        return this.screenInfo;
    }

    public async wdaPressButton(name: string): Promise<void> {
        return this.client?.requestWebDriverAgent('pressButton', {
            name,
        });
    }

    public async wdaPerformClick(position: Position): Promise<void> {
        if (!this.screenInfo) {
            return;
        }
        const wdaScreen = this.wdaScreen || (await this.getWdaScreen());
        const point = await WdaConnection.calculatePhysicalPoint(this.screenInfo, wdaScreen, position);
        if (!point) {
            return;
        }
        return this.client?.requestWebDriverAgent('click', {
            x: point.x,
            y: point.y,
        });
    }

    public async wdaPerformScroll(from: Position, to: Position): Promise<void> {
        if (!this.screenInfo) {
            return;
        }
        const wdaScreen = this.wdaScreen || (await this.getWdaScreen());
        const fromPoint = WdaConnection.calculatePhysicalPoint(this.screenInfo, wdaScreen, from);
        const toPoint = WdaConnection.calculatePhysicalPoint(this.screenInfo, wdaScreen, to);
        if (!fromPoint || !toPoint) {
            return;
        }
        return this.client?.requestWebDriverAgent('scroll', {
            from: {
                x: fromPoint.x,
                y: fromPoint.y,
            },
            to: {
                x: toPoint.x,
                y: toPoint.y,
            },
        });
    }

    private async getWdaScreen(): Promise<WdaScreen> {
        if (this.wdaScreen) {
            return this.wdaScreen;
        }
        const temp = await this.client?.requestWebDriverAgent('getScreen');
        if (temp.data.success) {
            return (this.wdaScreen = temp.data.response as WdaScreen);
        }
        throw Error('Invalid response');
    }

    public static calculatePhysicalPoint(
        screenInfo: ScreenInfo,
        wdaScreen: WdaScreen,
        position: Position,
    ): Point | undefined {
        const { statusBarSize } = wdaScreen;
        // ignore the locked video orientation, the events will apply in coordinates considered in the physical device orientation
        const { videoSize, deviceRotation, contentRect } = screenInfo;
        const { right, left, bottom, top } = contentRect;
        let shortSide: number;
        if (videoSize.width >= videoSize.height) {
            shortSide = bottom - top;
        } else {
            shortSide = right - left;
        }
        const scale = shortSide / statusBarSize.width;

        // reverse the video rotation to apply the events
        const devicePosition = position.rotate(deviceRotation);

        if (!videoSize.equals(devicePosition.screenSize)) {
            // The client sends a click relative to a video with wrong dimensions,
            // the device may have been rotated since the event was generated, so ignore the event
            return;
        }
        const { point } = devicePosition;
        const convertedX = contentRect.left + (point.x * contentRect.getWidth()) / videoSize.width;
        const convertedY = contentRect.top + (point.y * contentRect.getHeight()) / videoSize.height;

        const scaledX = Math.round(convertedX / scale);
        const scaledY = Math.round(convertedY / scale);

        return new Point(scaledX, scaledY);
    }

    public setClient(client: WsQVHackClient): void {
        this.client = client;
    }
}
