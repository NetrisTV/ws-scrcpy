// @ts-ignore
import * as logcat from 'adbkit-logcat';
import { Filters, FiltersMap, TextFilter, FiltersArray } from '../common/LogcatMessage';
import { AdbKitLogcatEntry } from '../common/AdbKitLogcat';

const REGEXP = /\/(.*)\/(mi|m|im|i)?/;

export enum ACTION {
    ADD,
    REMOVE
}

export enum PriorityLevel {
    UNKNOWN = 0,
    DEFAULT = 1,
    VERBOSE = 2,
    DEBUG = 3,
    INFO = 4,
    WARN = 5,
    ERROR = 6,
    FATAL = 7,
    SILENT = 8
}

export enum Fields {
    Priority = 'priority',
    Tag = 'tag',
    Message = 'message',
    PID = 'pid',
    TID = 'tid'
}

export class LogsFilter {
    public static filterEvent(filters: Filters, event: AdbKitLogcatEntry): boolean {
        if (!this.checkInMap(filters.priority, event.priority, event.pid.toString(10), filters.pid)) {
            return false;
        }
        if (!this.checkInMap(filters.priority, event.priority, event.tid.toString(10), filters.tid)) {
            return false;
        }
        if (!this.checkInMap(filters.priority, event.priority, event.tag, filters.tag)) {
            return false;
        }
        if (!this.checkText(event.priority, event.message, filters.message)) {
            return false;
        }
        if (!filters.pid && !filters.tid && !filters.tag && !filters.message) {
            return filters.priority <= event.priority;
        }
        return true;
    }

    private static checkInMap(defaultPriority: PriorityLevel, priority: PriorityLevel, value: string, filterList: FiltersMap): boolean {
        if (typeof filterList === 'undefined') {
            return true;
        }
        const stored: PriorityLevel | undefined = filterList.get(value);
        const wanted = typeof stored !== 'undefined' ? stored : defaultPriority;
        return wanted <= priority;
    }

    private static checkText(priority: PriorityLevel, value: string, filterList: FiltersArray): boolean {
        if (typeof filterList === 'undefined' || !filterList.length) {
            return true;
        }
        return filterList.every(filter => {
            const isRegExp = filter.value instanceof RegExp;
            if ((!isRegExp && value.includes(filter.value as string))
                || (isRegExp && !!value.match(filter.value))) {
                return filter.priority <= priority;
            }
            return true;
        });
    }

    private static updateFiltersMap(action: ACTION,
                                      priority: PriorityLevel,
                                      value: string,
                                      filterMap: FiltersMap): FiltersMap | null {
        const result: FiltersMap = filterMap || new Map<string, PriorityLevel>();
        const stored: PriorityLevel | undefined = result.get(value);
        if (typeof filterMap === 'undefined'
            || typeof stored === 'undefined'
            || stored !== priority) {
            if (action === ACTION.ADD) {
                result.set(value, priority);
                return result;
            } else {
                return null;
            }
        }
        if (action === ACTION.ADD) {
            return null;
        } else {
            result.delete(value);
            if (!result.size) {
                return undefined;
            }
            return result;
        }
    }

    private static updateFiltersArray(action: ACTION,
                                          priority: PriorityLevel,
                                          value: string | RegExp,
                                          filterArray: FiltersArray): FiltersArray | null {
        const result: TextFilter[] = [];

        if (typeof filterArray === 'undefined' || !filterArray.length) {
            return [{
                priority,
                value
            }];
        }
        let foundSame = false;
        let changed = false;
        filterArray.forEach(filter => {
            let bothRegExp = false;
            let sameRegExp = false;
            if (value instanceof RegExp && filter.value instanceof RegExp) {
                bothRegExp = true;
                if (value.toString() === filter.value.toString()) {
                    sameRegExp = true;
                }
            }
            if ((bothRegExp && sameRegExp) || (!bothRegExp && filter.value === value)) {
                if (filter.priority === priority) {
                    foundSame = true;
                } else {
                    if (action === ACTION.ADD) {
                        result.push({
                            value: filter.value,
                            priority
                        });
                        changed = true;
                    }
                }
                return;
            }
            result.push(filter);
        });
        if (action === ACTION.ADD) {
            if (foundSame) {
                return null;
            }
            if (!changed) {
                result.push({
                    value,
                    priority
                });
            }
        }
        if (action === ACTION.REMOVE) {
            if (foundSame) {
                if (!result.length) {
                    return undefined;
                }
            }
            return null;
        }
        return result;
    }

    private static tryAsRegexp(value: string): RegExp | null {
        const match = value.match(REGEXP);
        if (!match) {
            return null;
        }
        let temp;
        try {
            temp = new RegExp(match[1], match[2]);
        } catch (e) {
            return null;
        }
        if (value === temp.toString()) {
            return temp;
        }
        return null;
    }

    public static updateFilter(action: ACTION, priority: PriorityLevel, value: string, type: string, filters: Filters): boolean {
        let updated = false;
        const tempRe = this.tryAsRegexp(value);
        const num = parseInt(value, 10);
        switch (type) {
            case Fields.TID: {
                if (isNaN(num)) {
                    return false;
                }
                const newFilter = LogsFilter.updateFiltersMap(action, priority, num.toString(10), filters.tid);
                if (newFilter !== null) {
                    filters.tid = newFilter;
                    updated = true;
                }
                break;
            }
            case Fields.PID: {
                if (isNaN(num)) {
                    return false;
                }
                const newFilter = LogsFilter.updateFiltersMap(action, priority, num.toString(10), filters.pid);
                if (newFilter !== null) {
                    filters.pid = newFilter;
                    updated = true;
                }
                break;
            }
            case Fields.Tag: {
                const newFilter = LogsFilter.updateFiltersMap(action, priority, value, filters.tag);
                if (newFilter !== null) {
                    filters.tag = newFilter;
                    updated = true;
                }
                break;
            }
            case Fields.Message: {
                const str = tempRe ? tempRe : value;
                const newFilter = LogsFilter.updateFiltersArray(action, priority, str, filters.message);
                if (newFilter !== null) {
                    filters.message = newFilter;
                    updated = true;
                }
                break;
            }
            default:
                throw Error('Unknown filter type');
        }
        return updated;
    }

    // Reexport logcat.Priority methods

    public static priorityFromName(str: string): PriorityLevel {
        return logcat.Priority.fromName(str) as PriorityLevel;
    }
    public static priorityToName(priority: PriorityLevel): string {
        return logcat.Priority.toName(priority) as string;
    }
    public static priorityFromLetter(letter: string): PriorityLevel {
        return logcat.Priority.fromLetter(letter) as PriorityLevel;
    }
    public static priorityToLetter (priority: PriorityLevel): string {
        return logcat.Priority.toLetter(priority) as string;
    }
}
