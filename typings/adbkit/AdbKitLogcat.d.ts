import { EventEmitter } from 'events';
import { PriorityLevel } from './PriorityLevel';

export interface AdbKitLogcatEntry {
    date: Date;
    pid: number;
    tid: number;
    priority: PriorityLevel; // You can use `logcat.Priority` to convert the value into a String.
    tag: string;
    message: string;
}

export enum AdbKitLogcatReaderEvents {
    'error',
    'end',
    'finish',
    'entry',
}

declare interface PriorityMethods {
    fromLetter(letter: string): PriorityLevel;
    fromName(name: string): PriorityLevel;
    toLetter(priority: PriorityLevel): string;
    toName(priority: PriorityLevel): string;
}

export type AdbKitLogcatPriority = PriorityLevel & PriorityMethods;

export interface AdbKitLogcatReader extends EventEmitter {
    end(): AdbKitLogcatReader;
    exclude(tag: string): AdbKitLogcatReader;
    excludeAll(): AdbKitLogcatReader;
    include(tag: string, priority?: number | string): AdbKitLogcatReader;
    includeAll(priority?: number | string): AdbKitLogcatReader;
    resetFilters(): AdbKitLogcatReader;
}
