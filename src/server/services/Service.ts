export interface Service {
    getName(): string;
    start(): Promise<void>;
    release(): void;
}

export interface ServiceClass {
    getInstance(): Service;
    hasInstance(): boolean;
}
