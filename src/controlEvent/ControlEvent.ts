export default class ControlEvent {
    public static TYPE_KEYCODE: number = 0;
    public static TYPE_TEXT: number = 1;
    public static TYPE_MOUSE: number = 2;
    public static TYPE_SCROLL: number = 3;
    public static TYPE_COMMAND: number = 4;

    public static KEYCODE_PAYLOAD_LENGTH: number = 9;
    public static MOUSE_PAYLOAD_LENGTH: number = 17;
    public static SCROLL_PAYLOAD_LENGTH: number = 20;
    public static COMMAND_PAYLOAD_LENGTH: number = 1;

    constructor(readonly type: number) {
    }

    public toBuffer(): Buffer {
        throw Error('Not implemented');
    }
}
