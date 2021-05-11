import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, HostItem } from '../types/Configuration';
import { EnvName } from './EnvName';

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
        const isAbsolute = configPath.startsWith('/');
        const absolutePath = isAbsolute ? configPath : path.resolve(process.cwd(), configPath);
        if (!fs.existsSync(absolutePath)) {
            console.error(`Can't find configuration file "${absolutePath}"`);
            return;
        }
        try {
            const configString = fs.readFileSync(absolutePath).toString();
            this.fullConfig = JSON.parse(configString);
        } catch (e) {
            console.error(`Failed to load configuration from file "${absolutePath}"`);
            console.error(`Error: ${e.message}`);
        }
    }

    public getHostList(): HostItem[] {
        if (!this.fullConfig.hostList || !this.fullConfig.hostList.length) {
            return [];
        }
        return this.fullConfig.hostList.splice(0);
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
}
