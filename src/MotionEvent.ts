export default class MotionEvent {
    public static ACTION_DOWN = 0;
    public static ACTION_UP = 1;
    public static ACTION_MOVE = 2;
    /**
     * Button constant: Primary button (left mouse button).
     */
    public static BUTTON_PRIMARY: number = 1 << 0;

    /**
     * Button constant: Secondary button (right mouse button).
     */
    public static BUTTON_SECONDARY: number = 1 << 1;

    /**
     * Button constant: Tertiary button (middle mouse button).
     */
    public static BUTTON_TERTIARY: number = 1 << 2;
}
