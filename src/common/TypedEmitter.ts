import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, any>;
export type EventKey<T extends EventMap> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

interface Emitter<T extends EventMap> {
    on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
    off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
    emit<K extends EventKey<T>>(eventName: K, params: T[K]): void;
}

export class TypedEmitter<T extends EventMap> implements Emitter<T> {
    private emitter = new EventEmitter();
    addEventListener<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        this.emitter.on(eventName, fn);
    }

    removeEventListener<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        this.emitter.off(eventName, fn);
    }

    dispatchEvent(event: Event): boolean {
        return this.emitter.emit(event.type, event);
    }

    on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        this.emitter.on(eventName, fn);
    }

    once<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        this.emitter.once(eventName, fn);
    }

    off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        this.emitter.off(eventName, fn);
    }

    emit<K extends EventKey<T>>(eventName: K, params: T[K]): boolean {
        return this.emitter.emit(eventName, params);
    }
}
