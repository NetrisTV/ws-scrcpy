import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, HostItem } from '../types/Configuration';

export class Config {
    private static instance?: Config;
    public static getInstance(defaultConfig: Configuration = {}): Config {
        if (!this.instance) {
            this.instance = new Config(defaultConfig);
        }
        return this.instance;
    }

    private readonly localAndroid: boolean;

    constructor(private fullConfig: Configuration = {}) {
        this.localAndroid = true;

        const configPath = process.env.WS_SCRCPY_CONFIG;
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
        if (typeof this.fullConfig.localAndroid === 'boolean') {
            this.localAndroid = this.fullConfig.localAndroid;
        }
    }

    public isLocalAndroidTrackerEnabled(): boolean {
        return this.localAndroid;
    }

    public getRemoteAndroidTrackers(): HostItem[] {
        if (!this.fullConfig.remote || !this.fullConfig.remote.length) {
            return [];
        }
        return this.fullConfig.remote.filter((item) => item.type === 'android');
    }
}
