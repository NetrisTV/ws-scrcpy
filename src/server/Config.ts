import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, HostItem, ServerItem } from '../types/Configuration';
import { EnvName } from './EnvName';
import YAML from 'yaml';

const DEFAULT_PORT = 8000;

const YAML_RE = /^.+\.(yaml|yml)$/i;
const JSON_RE = /^.+\.(json|js)$/i;

export class Config {
    private static instance?: Config;
    public static getInstance(defaultConfig?: Configuration): Config {
        if (!defaultConfig) {
            defaultConfig = {
                runGoogTracker: false,
                runApplTracker: false,
                announceGoogTracker: false,
                announceApplTracker: false,
            };
            /// #if INCLUDE_GOOG
            defaultConfig.runGoogTracker = true;
            defaultConfig.announceGoogTracker = true;
            /// #endif

            /// #if INCLUDE_APPL
            defaultConfig.runApplTracker = true;
            defaultConfig.announceApplTracker = true;
            /// #endif
        }
        if (!this.instance) {
            this.instance = new Config(defaultConfig);
        }
        return this.instance;
    }

    constructor(private fullConfig: Configuration) {
        const configPath = process.env[EnvName.CONFIG_PATH];
        if (!configPath) {
            return;
        }
        if (configPath.match(YAML_RE)) {
            this.fullConfig = YAML.parse(this.readFile(configPath));
        } else if (configPath.match(JSON_RE)) {
            this.fullConfig = JSON.parse(this.readFile(configPath));
        } else {
            throw Error(`Unknown file type: ${configPath}`);
        }
    }

    public readFile(pathString: string): string {
        const isAbsolute = pathString.startsWith('/');
        const absolutePath = isAbsolute ? pathString : path.resolve(process.cwd(), pathString);
        if (!fs.existsSync(absolutePath)) {
            throw Error(`Can't find file "${absolutePath}"`);
        }
        return fs.readFileSync(absolutePath).toString();
    }

    public getHostList(): HostItem[] {
        if (!this.fullConfig.remoteHostList || !this.fullConfig.remoteHostList.length) {
            return [];
        }
        const hostList: HostItem[] = [];
        this.fullConfig.remoteHostList.forEach((item) => {
            const { hostname, port, secure, useProxy } = item;
            if (Array.isArray(item.type)) {
                item.type.forEach((type) => {
                    hostList.push({
                        hostname,
                        port,
                        secure,
                        useProxy,
                        type,
                    });
                });
            } else {
                hostList.push({ hostname, port, secure, useProxy, type: item.type });
            }
        });
        return hostList;
    }

    public getRunLocalGoogTracker(): boolean {
        return !!this.fullConfig.runGoogTracker;
    }

    public getAnnounceLocalGoogTracker(): boolean {
        if (typeof this.fullConfig.announceGoogTracker === 'boolean') {
            return this.fullConfig.announceGoogTracker;
        }
        return this.fullConfig.runGoogTracker === true;
    }

    public getRunLocalApplTracker(): boolean {
        return !!this.fullConfig.runApplTracker;
    }

    public getAnnounceLocalApplTracker(): boolean {
        if (typeof this.fullConfig.announceApplTracker === 'boolean') {
            return this.fullConfig.announceApplTracker;
        }
        return this.fullConfig.runApplTracker === true;
    }

    public getServers(): ServerItem[] {
        if (!Array.isArray(this.fullConfig.server)) {
            return [
                {
                    secure: false,
                    port: DEFAULT_PORT,
                },
            ];
        }
        return this.fullConfig.server;
    }
}
