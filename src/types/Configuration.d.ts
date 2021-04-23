export interface HostItem {
    type: 'android' | 'ios';
    secure: boolean;
    hostname: string;
    port: number;
    useProxy?: boolean;
}

export interface Configuration {
    remote?: HostItem[];
}
