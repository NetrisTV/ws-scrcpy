export interface CpuStats {
    user: number;
    nice: number;
    system: number;
    idle: number;
    iowait: number;
    irq: number;
    softirq: number;
    steal: number;
    guest: number;
    guestnice: number;
    total: number;
}
export interface Loads {
    [index: string]: CpuStats;
}
