export class ServerVersion {
    protected parts: string[] = [];
    protected suffix: string;
    protected readonly compatible: boolean;

    constructor(public readonly versionString: string) {
        const temp = versionString.split('-');
        const main = temp.shift();
        this.suffix = temp.join('-');
        if (main) {
            this.parts = main.split('.');
        }
        this.compatible = this.suffix.startsWith('ws') && this.parts.length >= 2;
    }
    public equals(a: ServerVersion | string): boolean {
        const versionString = typeof a === 'string' ? a : a.versionString;
        return this.versionString === versionString;
    }
    public gt(a: ServerVersion | string): boolean {
        if (this.equals(a)) {
            return false;
        }
        if (typeof a === 'string') {
            a = new ServerVersion(a);
        }
        const minLength = Math.min(this.parts.length, a.parts.length);
        for (let i = 0; i < minLength; i++) {
            if (this.parts[i] > a.parts[i]) {
                return true;
            }
        }
        if (this.parts.length > a.parts.length) {
            return true;
        }
        if (this.parts.length < a.parts.length) {
            return false;
        }
        return this.suffix > a.suffix;
    }
    public isCompatible(): boolean {
        return this.compatible;
    }
}
