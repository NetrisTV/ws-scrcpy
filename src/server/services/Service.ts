export interface Service {
    getName(): string;
    start(): void;
    release(): void;
}

export interface ServiceClass {
    getInstance(): Service;
}
