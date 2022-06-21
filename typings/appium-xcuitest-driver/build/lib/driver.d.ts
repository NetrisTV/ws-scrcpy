import { BaseDriver } from 'appium-base-driver';

declare interface ScreenInfo {
    statusBarSize: { width: number; height: number };
    scale: number;
}

declare interface Gesture {
    action: string;
    options: {
        x?: number;
        y?: number;
        ms?: number;
    };
}

declare class XCUITestDriver extends BaseDriver {
    constructor(opts: Record<string, any>, shouldValidateCaps: boolean);
    public createSession(...args: any): Promise<any>;
    public findElement(strategy: string, selector: string): Promise<any>;
    public getSize(element: any): Promise<{ width: number; height: number } | undefined>;
    public getScreenInfo(): Promise<ScreenInfo>;
    public performTouch(gestures: Gesture[]): Promise<any>;
    public mobilePressButton(args: { name: string }): Promise<any>;
    public stop(): Promise<void>;
    public deleteSession(): Promise<void>;
    public updateSettings(opts: any): Promise<void>;
    public keys(value: string): Promise<void>;
    public wda: any;
}

export default XCUITestDriver;
export { XCUITestDriver };
