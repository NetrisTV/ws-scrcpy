import KeyCodeControlEvent from "./controlEvent/KeyCodeControlEvent";
import KeyEvent from "./android/KeyEvent";
import {KeyToCodeMap} from "./KeyToCodeMap";

export interface KeyEventListener {
    onKeyEvent: (event: KeyCodeControlEvent) => void;
}

export class KeyInputHandler {
    private static readonly listeners: Set<KeyEventListener> = new Set();
    private static handler = (e: Event): void => {
        const event = e as KeyboardEvent;
        const keyCode = KeyToCodeMap.get(event.code);
        if (!keyCode) {
            return;
        }
        const action = event.type === 'keydown' ? KeyEvent.ACTION_DOWN :
            event.type === 'keyup' ? KeyEvent.ACTION_UP : -1;
        const metaState = (event.getModifierState('Alt') ? KeyEvent.META_ALT_ON : 0)
            | (event.getModifierState('Shift') ? KeyEvent.META_SHIFT_ON : 0)
            | (event.getModifierState('Control') ? KeyEvent.META_CTRL_ON : 0)
            | (event.getModifierState('Meta') ? KeyEvent.META_META_ON : 0)
            | (event.getModifierState('CapsLock') ? KeyEvent.META_CAPS_LOCK_ON : 0)
            | (event.getModifierState('ScrollLock') ? KeyEvent.META_SCROLL_LOCK_ON : 0)
            | (event.getModifierState('NumLock') ? KeyEvent.META_NUM_LOCK_ON : 0);

        const controlEvent: KeyCodeControlEvent = new KeyCodeControlEvent(action, keyCode, metaState);
        KeyInputHandler.listeners.forEach(listener => {
            listener.onKeyEvent(controlEvent);
        });
        e.preventDefault();
    }
    private static attachListeners(): void {
        document.body.addEventListener('keydown', this.handler);
        document.body.addEventListener('keyup', this.handler);
    }
    private static detachListeners(): void {
        document.body.removeEventListener('keydown', this.handler);
        document.body.removeEventListener('keyup', this.handler);
    }
    public static addEventListener(listener: KeyEventListener): void {
        if (!this.listeners.size) {
            this.attachListeners();
        }
        this.listeners.add(listener);
    }
    public static removeEventListener(listener: KeyEventListener): void {
        this.listeners.delete(listener);
        if (!this.listeners.size) {
            this.detachListeners();
        }
    }
}
