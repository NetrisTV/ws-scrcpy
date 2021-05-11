export class DeviceSettings {
    constructor(
        defaultSettings: Record<string, any>,
        onSettingsUpdate?: (name: string, newValue: any, oldValue: any) => Promise<void>,
    );
    public update(newSettings: Record<string, any>): Promise<void>;
    public getSettings(): Record<string, any>;
}
