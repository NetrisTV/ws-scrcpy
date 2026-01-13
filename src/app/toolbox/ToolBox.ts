import { ToolBoxElement } from './ToolBoxElement';

export class ToolBox {
    private readonly holder: HTMLElement;
    private isDragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;

    constructor(list: ToolBoxElement<any>[]) {
        this.holder = document.createElement('div');
        this.holder.classList.add('control-buttons-list', 'control-wrapper');
        list.forEach((item) => {
            item.getAllElements().forEach((el) => {
                this.holder.appendChild(el);
            });
        });

        // Initialize drag functionality
        this.initDrag();
    }

    private initDrag(): void {
        this.holder.addEventListener('mousedown', this.onDragStart);
        this.holder.addEventListener('touchstart', this.onTouchStart, { passive: false });
    }

    private onDragStart = (e: MouseEvent): void => {
        // Only start drag if clicking on the toolbar itself or the drag handle area
        // Don't drag when clicking on buttons
        const target = e.target as HTMLElement;
        if (target.classList.contains('control-button') || target.closest('.control-button')) {
            return;
        }

        e.preventDefault();
        this.isDragging = true;
        this.holder.classList.add('dragging');

        const rect = this.holder.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);
    };

    private onTouchStart = (e: TouchEvent): void => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('control-button') || target.closest('.control-button')) {
            return;
        }

        if (e.touches.length === 1) {
            e.preventDefault();
            this.isDragging = true;
            this.holder.classList.add('dragging');

            const touch = e.touches[0];
            const rect = this.holder.getBoundingClientRect();
            this.dragOffsetX = touch.clientX - rect.left;
            this.dragOffsetY = touch.clientY - rect.top;

            document.addEventListener('touchmove', this.onTouchMove, { passive: false });
            document.addEventListener('touchend', this.onTouchEnd);
        }
    };

    private onDragMove = (e: MouseEvent): void => {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffsetX;
        const y = e.clientY - this.dragOffsetY;
        this.setPosition(x, y);
    };

    private onTouchMove = (e: TouchEvent): void => {
        if (!this.isDragging || e.touches.length !== 1) return;

        e.preventDefault();
        const touch = e.touches[0];
        const x = touch.clientX - this.dragOffsetX;
        const y = touch.clientY - this.dragOffsetY;
        this.setPosition(x, y);
    };

    private setPosition(x: number, y: number): void {
        // Constrain to viewport
        const rect = this.holder.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));

        this.holder.style.left = `${x}px`;
        this.holder.style.top = `${y}px`;
        this.holder.style.transform = 'none'; // Remove the translateY(-50%)
    }

    private onDragEnd = (): void => {
        this.isDragging = false;
        this.holder.classList.remove('dragging');
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
    };

    private onTouchEnd = (): void => {
        this.isDragging = false;
        this.holder.classList.remove('dragging');
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);
    };

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public destroy(): void {
        this.holder.removeEventListener('mousedown', this.onDragStart);
        this.holder.removeEventListener('touchstart', this.onTouchStart);
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);
    }
}
