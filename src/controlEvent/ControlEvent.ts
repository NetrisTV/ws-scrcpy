export default class ControlEvent {
    public static TYPE_KEYCODE: number = 0;
    public static TYPE_TEXT: number = 1;
    public static TYPE_MOUSE: number = 2;
    public static TYPE_SCROLL: number = 3;
    public static TYPE_BACK_OR_SCREEN_ON: number = 4;
    public static TYPE_EXPAND_NOTIFICATION_PANEL: number = 5;
    public static TYPE_COLLAPSE_NOTIFICATION_PANEL: number = 6;
    public static TYPE_GET_CLIPBOARD: number = 7;
    public static TYPE_SET_CLIPBOARD: number = 8;
    public static TYPE_SET_SCREEN_POWER_MODE: number = 9;
    public static TYPE_ROTATE_DEVICE: number = 10;
    public static TYPE_CHANGE_STREAM_PARAMETERS: number = 101;
    public static TYPE_PUSH_FILE: number = 102;

    constructor(readonly type: number) {
    }

    public toBuffer(): Buffer {
        throw Error('Not implemented');
    }

    public toString(): string {
        return 'ControlEvent';
    }
}
