import { KeyCodeControlMessage } from '../controlMessage/KeyCodeControlMessage';
import KeyEvent from './android/KeyEvent';
import { KeyToCodeMap } from './KeyToCodeMap';

export interface KeyEventListener {
    onKeyEvent: (event: KeyCodeControlMessage) => void;
}

export class KeyInputHandler {
    private static readonly repeatCounter: Map<number, number> = new Map();
    private static readonly listeners: Set<KeyEventListener> = new Set();
    private static handler = (event: Event): void => {
        const keyboardEvent = event as KeyboardEvent;
        const keyCode = KeyToCodeMap.get(keyboardEvent.code);
        if (!keyCode) {
            return;
        }
        let action: typeof KeyEvent.ACTION_DOWN | typeof KeyEvent.ACTION_DOWN;
        let repeatCount = 0;
        if (keyboardEvent.type === 'keydown') {
            action = KeyEvent.ACTION_DOWN;
            if (keyboardEvent.repeat) {
                let count = KeyInputHandler.repeatCounter.get(keyCode);
                if (typeof count !== 'number') {
                    count = 1;
                } else {
                    count++;
                }
                repeatCount = count;
                KeyInputHandler.repeatCounter.set(keyCode, count);
            }
        } else if (keyboardEvent.type === 'keyup') {
            action = KeyEvent.ACTION_UP;
            KeyInputHandler.repeatCounter.delete(keyCode);
        } else {
            return;
        }
        const metaState =
            (keyboardEvent.getModifierState('Alt') ? KeyEvent.META_ALT_ON : 0) |
            (keyboardEvent.getModifierState('Shift') ? KeyEvent.META_SHIFT_ON : 0) |
            (keyboardEvent.getModifierState('Control') ? KeyEvent.META_CTRL_ON : 0) |
            (keyboardEvent.getModifierState('Meta') ? KeyEvent.META_META_ON : 0) |
            (keyboardEvent.getModifierState('CapsLock') ? KeyEvent.META_CAPS_LOCK_ON : 0) |
            (keyboardEvent.getModifierState('ScrollLock') ? KeyEvent.META_SCROLL_LOCK_ON : 0) |
            (keyboardEvent.getModifierState('NumLock') ? KeyEvent.META_NUM_LOCK_ON : 0);

        const controlMessage: KeyCodeControlMessage = new KeyCodeControlMessage(
            action,
            keyCode,
            repeatCount,
            metaState,
        );
        KeyInputHandler.listeners.forEach((listener) => {
            listener.onKeyEvent(controlMessage);
        });
        event.preventDefault();
    };
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
