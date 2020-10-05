export enum MessageType {
    'devicelist' = 'devicelist',
    'shell' = 'shell',
    'run-wda' = 'run-wda',
}

export interface Message {
    id: number;
    type: string;
    data: any;
}
