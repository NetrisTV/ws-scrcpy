import { BaseDriver } from 'appium-base-driver';

declare interface Gesture {
    action: string;
    options: {
        x?: number;
        y?: number;
        ms?: number;
    }
}

declare class XCUITestDriver extends BaseDriver {
    constructor (opts: Record<string, any>, shouldValidateCaps: boolean);
    public createSession(...args: any): Promise<any>;
    public getScreenInfo(): Promise<any>;
    public performTouch(gestures: Gesture[]): Promise<any>;
    public mobilePressButton(args: {name: string}): Promise<any>;
}


export default XCUITestDriver;
export { XCUITestDriver };
