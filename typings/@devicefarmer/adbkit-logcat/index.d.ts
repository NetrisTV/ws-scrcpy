import { EventEmitter } from 'events';

declare enum PriorityLevel {
    UNKNOWN = 0,
    DEFAULT = 1,
    VERBOSE = 2,
    DEBUG = 3,
    INFO = 4,
    WARN = 5,
    ERROR = 6,
    FATAL = 7,
    SILENT = 8,
}


declare interface AdbKitLogcatEntry {
    date: Date;
    pid: number;
    tid: number;
    priority: PriorityLevel; // You can use `logcat.Priority` to convert the value into a String.
    tag: string;
    message: string;
}

declare enum AdbKitLogcatReaderEvents {
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

type AdbKitLogcatPriority = PriorityLevel & PriorityMethods;

interface AdbKitLogcatReader extends EventEmitter {
    end(): AdbKitLogcatReader;
    exclude(tag: string): AdbKitLogcatReader;
    excludeAll(): AdbKitLogcatReader;
    include(tag: string, priority?: number | string): AdbKitLogcatReader;
    includeAll(priority?: number | string): AdbKitLogcatReader;
    resetFilters(): AdbKitLogcatReader;
}

export = AdbKitLogcatReader;
