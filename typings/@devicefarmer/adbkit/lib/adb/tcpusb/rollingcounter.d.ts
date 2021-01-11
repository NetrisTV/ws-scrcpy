declare class RollingCounter {
    private readonly max;
    private readonly min;
    private now;
    constructor(max: number, min?: number);
    next(): number;
}
export = RollingCounter;
