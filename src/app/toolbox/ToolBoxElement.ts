export type Optional = {
    [index: string]: any;
};

// type Listener = <K extends keyof HTMLElementEventMap, T extends HTMLElement>(type: K, el: ToolBoxElement<T>) => any;

export abstract class ToolBoxElement<T extends HTMLElement> {
    private listeners: Map<string, Set<<K extends keyof HTMLElementEventMap>(type: K, el: ToolBoxElement<T>) => any>> =
        new Map();
    protected constructor(public readonly title: string, public readonly optional?: Optional) {}

    public abstract getElement(): T;
    public abstract getAllElements(): HTMLElement[];

    public addEventListener<K extends keyof HTMLElementEventMap>(
        type: K,
        listener: <K extends keyof HTMLElementEventMap>(type: K, el: ToolBoxElement<T>) => any,
        options?: boolean | AddEventListenerOptions,
    ): void {
        const set = this.listeners.get(type) || new Set();
        if (!set.size) {
            const element = this.getElement();
            element.addEventListener(type, this.onEvent, options);
        }
        set.add(listener);
        this.listeners.set(type, set);
    }
    public removeEventListener<K extends keyof HTMLElementEventMap>(
        type: K,
        listener: <K extends keyof HTMLElementEventMap>(type: K, el: ToolBoxElement<T>) => any,
    ): void {
        const set = this.listeners.get(type);
        if (!set) {
            return;
        }
        set.delete(listener);
        if (!set.size) {
            this.listeners.delete(type);
            const element = this.getElement();
            element.removeEventListener(type, this.onEvent);
        }
    }
    onEvent = <K extends keyof HTMLElementEventMap>(ev: HTMLElementEventMap[K]): void => {
        const set = this.listeners.get(ev.type);
        if (!set) {
            return;
        }
        const type = ev.type as K;
        set.forEach((listener) => {
            listener(type, this);
        });
    };
}
