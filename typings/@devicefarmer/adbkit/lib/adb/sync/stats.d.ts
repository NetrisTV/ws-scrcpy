/// <reference types="node" />
import * as Fs from 'fs';
declare class Stats extends Fs.Stats {
    static S_IFMT: number;
    static S_IFSOCK: number;
    static S_IFLNK: number;
    static S_IFREG: number;
    static S_IFBLK: number;
    static S_IFDIR: number;
    static S_IFCHR: number;
    static S_IFIFO: number;
    static S_ISUID: number;
    static S_ISGID: number;
    static S_ISVTX: number;
    static S_IRWXU: number;
    static S_IRUSR: number;
    static S_IWUSR: number;
    static S_IXUSR: number;
    static S_IRWXG: number;
    static S_IRGRP: number;
    constructor(mode: number, size: number, mtime: number);
}
export = Stats;
