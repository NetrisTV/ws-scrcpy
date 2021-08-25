export interface DragEventListener {
    onDragEnter: () => boolean;
    onDragLeave: () => boolean;
    onFilesDrop: (files: File[]) => boolean;
    getElement: () => HTMLElement;
}

export class DragAndDropHandler {
    private static readonly listeners: Set<DragEventListener> = new Set();
    private static dropHandler = (ev: DragEvent): boolean => {
        if (!ev.dataTransfer) {
            return false;
        }

        const files: File[] = [];
        if (ev.dataTransfer.items) {
            for (let i = 0; i < ev.dataTransfer.items.length; i++) {
                if (ev.dataTransfer.items[i].kind === 'file') {
                    const file = ev.dataTransfer.items[i].getAsFile();

                    if (file) {
                        files.push(file);
                    }
                }
            }
        } else {
            for (let i = 0; i < ev.dataTransfer.files.length; i++) {
                files.push(ev.dataTransfer.files[i]);
            }
        }
        let handled = false;
        DragAndDropHandler.listeners.forEach((listener) => {
            const element = listener.getElement();
            if (element === ev.currentTarget) {
                handled = handled || listener.onFilesDrop(files);
            }
        });
        if (handled) {
            ev.preventDefault();
            return true;
        }
        return false;
    };
    private static dragOverHandler = (ev: DragEvent): void => {
        ev.preventDefault();
    };
    private static dragLeaveHandler = (ev: DragEvent): boolean => {
        let handled = false;
        DragAndDropHandler.listeners.forEach((listener) => {
            const element = listener.getElement();
            if (element === ev.currentTarget) {
                handled = handled || listener.onDragLeave();
            }
        });
        if (handled) {
            ev.preventDefault();
            return true;
        }
        return false;
    };
    private static dragEnterHandler = (ev: DragEvent): boolean => {
        let handled = false;
        DragAndDropHandler.listeners.forEach((listener) => {
            const element = listener.getElement();
            if (element === ev.currentTarget) {
                handled = handled || listener.onDragEnter();
            }
        });
        if (handled) {
            ev.preventDefault();
            return true;
        }
        return false;
    };
    private static attachListeners(element: HTMLElement): void {
        element.addEventListener('drop', this.dropHandler);
        element.addEventListener('dragover', this.dragOverHandler);
        element.addEventListener('dragleave', this.dragLeaveHandler);
        element.addEventListener('dragenter', this.dragEnterHandler);
    }
    private static detachListeners(element: HTMLElement): void {
        element.removeEventListener('drop', this.dropHandler);
        element.removeEventListener('dragover', this.dragOverHandler);
        element.removeEventListener('dragleave', this.dragLeaveHandler);
        element.removeEventListener('dragenter', this.dragEnterHandler);
    }

    public static addEventListener(listener: DragEventListener): void {
        if (this.listeners.has(listener)) {
            return;
        }
        this.attachListeners(listener.getElement());
        this.listeners.add(listener);
    }
    public static removeEventListener(listener: DragEventListener): void {
        if (!this.listeners.has(listener)) {
            return;
        }
        this.detachListeners(listener.getElement());
        this.listeners.delete(listener);
    }
}
