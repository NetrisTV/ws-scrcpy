import { AdbKitLogcatEntry, AdbKitLogcatReaderEvents } from './AdbKitLogcat';
import { PriorityLevel } from './PriorityLevel';

export type FiltersMap = Map<string, PriorityLevel> | undefined;
export interface TextFilter {
    value: (string | RegExp);
    priority: PriorityLevel;
}
export type FiltersArray = TextFilter[] | undefined;
export type FiltersJoin = FiltersMap | FiltersArray;

export interface Filters {
    priority: PriorityLevel;
    pid?: FiltersMap;
    tid?: FiltersMap;
    tag?: FiltersMap;
    message?: FiltersArray;
}

export interface LogcatServiceMessage {
    type: keyof typeof AdbKitLogcatReaderEvents;
    udid: string;
    event?: AdbKitLogcatEntry | Error;
}

export enum LogcatServiceActions {
    start,
    stop,
    filter
}

export interface LogcatClientMessage {
    type: keyof typeof LogcatServiceActions;
    udid: string;
    filters?: Filters;
}
