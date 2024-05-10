import * as fs from 'fs';
import * as path from 'path';

type BuildConfig = Record<string, boolean | string>;

const DEFAULT_CONFIG_PATH = path.resolve(path.dirname(__filename), 'default.build.config.json');
const configCache: Map<string, BuildConfig> = new Map();
const mergedCache: Map<string, BuildConfig> = new Map();

export function getConfig(filename: string): BuildConfig {
    let cached = configCache.get(filename);
    if (!cached) {
        const filtered: BuildConfig = {};
        const absolutePath = path.isAbsolute(filename) ? filename : path.resolve(process.cwd(), filename);
        const rawConfig = JSON.parse(fs.readFileSync(absolutePath).toString());
        Object.keys(rawConfig).forEach((key) => {
            const value = rawConfig[key];
            if (typeof value === 'boolean' || typeof value === 'string') {
                filtered[key] = value;
            }
        });
        cached = filtered;
        configCache.set(filename, cached);
    }
    return cached;
}

export function mergeWithDefaultConfig(custom?: string): BuildConfig {
    if (!custom) {
        return getConfig(DEFAULT_CONFIG_PATH);
    }
    let cached = mergedCache.get(custom);
    if (!cached) {
        const defaultConfig = getConfig(DEFAULT_CONFIG_PATH);
        const customConfig = getConfig(custom);
        cached = Object.assign({}, defaultConfig, customConfig);
        mergedCache.set(custom, cached);
    }
    return cached;
}
