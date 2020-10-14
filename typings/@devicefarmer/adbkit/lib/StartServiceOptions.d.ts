interface Extra {
    key: string;
    type: 'string' | 'null' | 'bool' | 'int' | 'long' | 'float' | 'uri' | 'component';
    value?: string | number | boolean | string[] | number[] | boolean[];
}
export interface ExtraObject {
    [index: string]: ExtraValue;
}
export declare type ExtraValue = number | string | boolean | ExtraObject;
export interface StartServiceOptions {
    user?: number;
    action?: string;
    data?: string;
    mimeType?: string;
    category?: string | string[];
    component?: string;
    flags?: number | number[];
    extras?: Extra[] | ExtraObject;
}
export {};
