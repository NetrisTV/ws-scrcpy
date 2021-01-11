/// <reference types="node" />
import { EventEmitter } from 'events';
import Sync from '../sync';
import { CpuStats } from '../../CpuStats';
import Bluebird from 'bluebird';
interface CpuStatsWithLine extends CpuStats {
    line: string;
}
interface LoadsWithLine {
    [index: string]: CpuStatsWithLine;
}
declare type Stats = {
    cpus: LoadsWithLine;
};
declare class ProcStat extends EventEmitter {
    private sync;
    interval: number;
    stats: Stats;
    private readonly _ignore;
    private readonly _timer;
    constructor(sync: Sync);
    end(): Sync;
    update(): Bluebird<Stats>;
    private _parse;
    private _set;
    private _error;
    private _emptyStats;
}
export = ProcStat;
