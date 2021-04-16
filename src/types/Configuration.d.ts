export interface HostItem {
    type: 'android' | 'ios';
    secure: boolean;
    hostname: string;
    port: string;
}

export interface Configuration {
    localAndroid?: boolean;
    localIos?: boolean;
    remote?: HostItem[];
}
