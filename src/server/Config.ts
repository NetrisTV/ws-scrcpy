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
    private static initConfig(userConfig: Configuration = {}): Configuration {
        let runGoogTracker = false;
        let announceGoogTracker = false;
        /// #if INCLUDE_GOOG
        runGoogTracker = true;
        announceGoogTracker = true;
        /// #endif

        let runApplTracker = false;
        let announceApplTracker = false;
        /// #if INCLUDE_APPL
        runApplTracker = true;
        announceApplTracker = true;
        /// #endif
        const server: ServerItem[] = [];
        const defaultConfig = {
            runGoogTracker,
            runApplTracker,
            announceGoogTracker,
            announceApplTracker,
            server,
        };
        const merged = Object.assign({}, defaultConfig, userConfig);
        merged.server = merged.server.map((item) => this.parseServerItem(item));
        return merged;
    }
    private static parseServerItem(config: Partial<ServerItem> = {}): ServerItem {
        const secure = config.secure || false;
        const port = config.port || (secure ? 443 : 80);
        const options = config.options;
        const redirectToSecure = config.redirectToSecure || false;
        if (secure && !options) {
            throw Error('Must provide "options" for secure server configuration');
        }
        if (options?.certPath) {
            if (options.cert) {
                throw Error(`Can't use "cert" and "certPath" together`);
            }
            options.cert = this.readFile(options.certPath);
        }
        if (options?.keyPath) {
            if (options.key) {
                throw Error(`Can't use "key" and "keyPath" together`);
            }
            options.key = this.readFile(options.keyPath);
        }
        return {
            secure,
            port,
            options,
            redirectToSecure,
        };
    }
    public static getInstance(): Config {
        if (!this.instance) {
            const configPath = process.env[EnvName.CONFIG_PATH];
            let userConfig: Configuration;
            if (!configPath) {
                userConfig = {};
            } else {
                if (configPath.match(YAML_RE)) {
                    userConfig = YAML.parse(this.readFile(configPath));
                } else if (configPath.match(JSON_RE)) {
                    userConfig = JSON.parse(this.readFile(configPath));
                } else {
                    throw Error(`Unknown file type: ${configPath}`);
                }
            }
            const fullConfig = this.initConfig(userConfig);
            this.instance = new Config(fullConfig);
        }
        return this.instance;
    }

    public static readFile(pathString: string): string {
        const isAbsolute = pathString.startsWith('/');
        const absolutePath = isAbsolute ? pathString : path.resolve(process.cwd(), pathString);
        if (!fs.existsSync(absolutePath)) {
            throw Error(`Can't find file "${absolutePath}"`);
        }
        return fs.readFileSync(absolutePath).toString();
    }

    constructor(private fullConfig: Configuration) {}

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

    public get runLocalGoogTracker(): boolean {
        return !!this.fullConfig.runGoogTracker;
    }

    public get announceLocalGoogTracker(): boolean {
        if (typeof this.fullConfig.announceGoogTracker === 'boolean') {
            return this.fullConfig.announceGoogTracker;
        }
        return this.fullConfig.runGoogTracker === true;
    }

    public get runLocalApplTracker(): boolean {
        return !!this.fullConfig.runApplTracker;
    }

    public get announceLocalApplTracker(): boolean {
        if (typeof this.fullConfig.announceApplTracker === 'boolean') {
            return this.fullConfig.announceApplTracker;
        }
        return this.fullConfig.runApplTracker === true;
    }

    public get servers(): ServerItem[] {
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
