export interface HostItem {
    type: 'android' | 'ios';
    secure: boolean;
    hostname: string;
    port: string;
}

export interface Configuration {
    remote?: HostItem[];
}
