export class ControlCenterCommand {
    public static KILL_SERVER = 'kill_server';
    public static START_SERVER = 'start_server';
    public static UPDATE_INTERFACES = 'update_interfaces';
    public static CONFIGURE_STREAM = 'configure_stream';

    private type = '';
    private pid = 0;
    private udid = '';

    public static fromJSON(json: string): ControlCenterCommand {
        const data = JSON.parse(json);
        if (!data) {
            throw new Error('Invalid input');
        }
        if (typeof data.udid !== 'string' || !data.udid) {
            throw new Error('Missing "udid"');
        }
        const command = new ControlCenterCommand();
        command.type = data.command;
        command.udid = data.udid;
        switch (data.command) {
            case this.KILL_SERVER:
                if (typeof data.pid !== 'number' && data.pid <= 0) {
                    throw new Error('Invalid "pid" value');
                }
                command.pid = data.pid;
                return command;
            case this.START_SERVER:
            case this.UPDATE_INTERFACES:
            case this.CONFIGURE_STREAM:
                return command;
            default:
                throw new Error(`Unknown command "${data.command}"`);
        }
    }

    public getType(): string {
        return this.type;
    }
    public getPid(): number {
        return this.pid;
    }
    public getUdid(): string {
        return this.udid;
    }
}
