export interface HostItem {
    type: 'android' | 'ios';
    secure: boolean;
    hostname: string;
    port: number;
    useProxy?: boolean;
}

export interface Configuration {
    runApplTracker?: boolean;
    announceApplTracker?: boolean;
    runGoogTracker?: boolean;
    announceGoogTracker?: boolean;
    hostList?: HostItem[];
}
