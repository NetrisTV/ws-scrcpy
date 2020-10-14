import Stats from './stats';
declare class Entry extends Stats {
    name: string;
    constructor(name: string, mode: number, size: number, mtime: number);
    toString(): string;
}
export = Entry;
