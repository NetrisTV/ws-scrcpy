import Point from './Point';
import Position from './Position';
import ScreenInfo from './ScreenInfo';

interface WdaScreen {
    statusBarSize: Point;
    scale: number;
}

export default class WdaConnection {
    private screenInfo?: ScreenInfo;
    private wdaUrl?: string;
    private wdaSessionId?: string;
    private wdaScreen?: WdaScreen;

    public setScreenInfo(screenInfo: ScreenInfo): void {
        this.screenInfo = screenInfo;
    }

    public getScreenInfo(): ScreenInfo | undefined {
        return this.screenInfo;
    }

    public async wdaPressButton(name: string): Promise<void> {
        const sessionId = await this.getOrCreateWdaSessionId();
        if (!sessionId) {
            throw Error('No WDA session');
        }

        const response = await fetch(`${this.wdaUrl}/session/${sessionId}/wda/pressButton`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });
        const json = await response.json();
        if (json.value && json.value.error === 'invalid session id') {
            this.wdaSessionId = '';
            return this.wdaPressButton(name);
        }
    }

    public async wdaPerformClick(position: Position): Promise<void> {
        const sessionId = await this.getOrCreateWdaSessionId();
        if (!sessionId) {
            throw Error('No WDA session');
        }
        const point = await this.getPhysicalPoint(position);
        if (!point) {
            return;
        }
        const response = await fetch(`${this.wdaUrl}/session/${sessionId}/wda/touch/perform`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ actions: [{ action: 'tap', options: { x: point.x, y: point.y } }] }),
        });
        const json = await response.json();
        if (json.value && json.value.error === 'invalid session id') {
            this.wdaSessionId = '';
            return this.wdaPerformClick(position);
        }
    }

    public async wdaPerformScroll(from: Position, to: Position): Promise<void> {
        const sessionId = await this.getOrCreateWdaSessionId();
        if (!sessionId) {
            throw Error('No WDA session');
        }
        const fromPoint = await this.getPhysicalPoint(from);
        const toPoint = await this.getPhysicalPoint(to);
        if (!fromPoint || !toPoint) {
            return;
        }
        const response = await fetch(`${this.wdaUrl}/session/${sessionId}/wda/touch/perform`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                actions: [
                    { action: 'press', options: { x: fromPoint.x, y: fromPoint.y } },
                    { action: 'wait', options: { ms: 500 } },
                    { action: 'moveTo', options: { x: toPoint.x, y: toPoint.y } },
                    { action: 'release', options: {} },
                ],
            }),
        });
        const json = await response.json();
        if (json.value && json.value.error === 'invalid session id') {
            this.wdaSessionId = '';
            return this.wdaPerformScroll(from, to);
        }
    }

    private async getWdaScreen(): Promise<WdaScreen> {
        if (this.wdaScreen) {
            return this.wdaScreen;
        }
        const sessionId = await this.getOrCreateWdaSessionId();
        if (!sessionId) {
            throw Error('No WDA session');
        }
        const response = await fetch(`${this.wdaUrl}/session/${sessionId}/wda/screen`, {
            method: 'GET',
            mode: 'cors',
        });
        const json = await response.json();
        const { value } = json;
        const { width, height } = value['statusBarSize'];
        this.wdaScreen = {
            scale: value['scale'],
            statusBarSize: new Point(width, height),
        };
        return this.wdaScreen;
    }

    private async getOrCreateWdaSessionId(): Promise<string> {
        if (this.wdaSessionId) {
            return this.wdaSessionId;
        }
        if (!this.wdaUrl) {
            throw Error('No url');
        }
        let response = await fetch(`${this.wdaUrl}/status`);
        let json = await response.json();
        if (typeof json.sessionId === 'string' && json.sessionId !== 'null') {
            this.wdaSessionId = json.sessionId as string;
            return this.wdaSessionId;
        }
        response = await fetch(`${this.wdaUrl}/session`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ capabilities: { platformName: 'iOS' } }),
        });
        json = await response.json();
        if (typeof json.sessionId === 'string' && json.sessionId !== 'null') {
            this.wdaSessionId = json.sessionId as string;
            return this.wdaSessionId;
        }
        return '';
    }

    public async getPhysicalPoint(position: Position): Promise<Point | undefined> {
        if (!this.screenInfo) {
            return;
        }

        let wdaScreen = this.wdaScreen;
        if (!wdaScreen) {
            wdaScreen = await this.getWdaScreen();
        }
        const { scale } = wdaScreen;
        // ignore the locked video orientation, the events will apply in coordinates considered in the physical device orientation
        const { videoSize, deviceRotation, contentRect } = this.screenInfo;

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

    public setUrl(url: string): void {
        this.wdaUrl = url;
    }
}
