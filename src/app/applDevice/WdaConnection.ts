import Point from '../Point';
import Position from '../Position';
import ScreenInfo from '../ScreenInfo';
import { WsQVHackClient } from './client/WsQVHackClient';
import { WDAMethod } from '../../common/WDAMethod';

export default class WdaConnection {
    private screenInfo?: ScreenInfo;
    private client?: WsQVHackClient;
    private screenWidth = 0;

    public setScreenInfo(screenInfo: ScreenInfo): void {
        this.screenInfo = screenInfo;
    }

    public getScreenInfo(): ScreenInfo | undefined {
        return this.screenInfo;
    }

    public async wdaPressButton(name: string): Promise<void> {
        return this.client?.requestWebDriverAgent(WDAMethod.PRESS_BUTTON, {
            name,
        });
    }

    public async wdaPerformClick(position: Position): Promise<void> {
        if (!this.screenInfo) {
            return;
        }
        const screenWidth = this.screenWidth || (await this.getScreenWidth());
        const point = await WdaConnection.calculatePhysicalPoint(this.screenInfo, screenWidth, position);
        if (!point) {
            return;
        }
        return this.client?.requestWebDriverAgent(WDAMethod.CLICK, {
            x: point.x,
            y: point.y,
        });
    }

    public async wdaPerformScroll(from: Position, to: Position): Promise<void> {
        if (!this.screenInfo) {
            return;
        }
        const wdaScreen = this.screenWidth || (await this.getScreenWidth());
        const fromPoint = WdaConnection.calculatePhysicalPoint(this.screenInfo, wdaScreen, from);
        const toPoint = WdaConnection.calculatePhysicalPoint(this.screenInfo, wdaScreen, to);
        if (!fromPoint || !toPoint) {
            return;
        }
        return this.client?.requestWebDriverAgent(WDAMethod.SCROLL, {
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

    private async getScreenWidth(): Promise<number> {
        if (this.screenWidth) {
            return this.screenWidth;
        }
        const temp = await this.client?.requestWebDriverAgent(WDAMethod.GET_SCREEN_WIDTH);
        if (temp.data.success && typeof temp.data.response === 'number') {
            return (this.screenWidth = temp.data.response);
        }
        throw Error('Invalid response');
    }

    public static calculatePhysicalPoint(
        screenInfo: ScreenInfo,
        screenWidth: number,
        position: Position,
    ): Point | undefined {
        // ignore the locked video orientation, the events will apply in coordinates considered in the physical device orientation
        const { videoSize, deviceRotation, contentRect } = screenInfo;
        const { right, left, bottom, top } = contentRect;
        let shortSide: number;
        if (videoSize.width >= videoSize.height) {
            shortSide = bottom - top;
        } else {
            shortSide = right - left;
        }
        const scale = shortSide / screenWidth;

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
