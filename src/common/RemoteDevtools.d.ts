export interface VersionMetadata {
    'Android-Package': string;
    Browser: string;
    'Protocol-Version': string;
    'User-Agent': string;
    'V8-Version': string;
    'WebKit-Version': string;
    webSocketDebuggerUrl: string;
}

export interface TargetDescription {
    attached: boolean;
    empty: boolean;
    height: number;
    screenX: number;
    screenY: number;
    visible: boolean;
    width: number;
}

export interface RemoteTarget {
    description: TargetDescription;
    devtoolsFrontendUrl: string;
    faviconUrl: string;
    id: string;
    title: string;
    type: string;
    url: string;
    webSocketDebuggerUrl: string;
}

export type DevtoolsInfo = {
    socket: string;
    version: VersionMetadata;
    targets: RemoteTarget[];
};
