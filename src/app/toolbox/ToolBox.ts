import { ToolBoxElement } from './ToolBoxElement';

export class ToolBox {
    private readonly holder: HTMLElement;
    private readonly contentWrapper: HTMLElement;
    private readonly toggleButton: HTMLButtonElement;
    private isDragging = false;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private isCollapsed = false;

    constructor(list: ToolBoxElement<any>[]) {
        this.holder = document.createElement('div');
        this.holder.classList.add('control-buttons-list', 'control-wrapper');

        // Create toggle button for collapse/expand
        this.toggleButton = document.createElement('button');
        this.toggleButton.classList.add('toolbox-toggle');
        this.toggleButton.innerHTML = this.getToggleIcon(false);
        this.toggleButton.title = 'Collapse toolbar';
        this.toggleButton.addEventListener('click', this.onToggle);
        this.holder.appendChild(this.toggleButton);

        // Create content wrapper for the actual tools
        this.contentWrapper = document.createElement('div');
        this.contentWrapper.classList.add('toolbox-content');
        list.forEach((item) => {
            item.getAllElements().forEach((el) => {
                this.contentWrapper.appendChild(el);
            });
        });
        this.holder.appendChild(this.contentWrapper);

        // Initialize drag functionality
        this.initDrag();
    }

    private getToggleIcon(collapsed: boolean): string {
        if (collapsed) {
            // Expand icon (chevron down / plus)
            return '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
        } else {
            // Collapse icon (chevron up / minus)
            return '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>';
        }
    }

    private onToggle = (e: MouseEvent): void => {
        e.stopPropagation();
        this.isCollapsed = !this.isCollapsed;
        this.holder.classList.toggle('collapsed', this.isCollapsed);
        this.toggleButton.innerHTML = this.getToggleIcon(this.isCollapsed);
        this.toggleButton.title = this.isCollapsed ? 'Expand toolbar' : 'Collapse toolbar';
    };

    private initDrag(): void {
        this.holder.addEventListener('mousedown', this.onDragStart);
        this.holder.addEventListener('touchstart', this.onTouchStart, { passive: false });
    }

    private onDragStart = (e: MouseEvent): void => {
        // Only start drag if clicking on the toolbar itself or the drag handle area
        // Don't drag when clicking on buttons or the toggle button
        const target = e.target as HTMLElement;
        if (target.classList.contains('control-button') || target.closest('.control-button') ||
            target.classList.contains('toolbox-toggle') || target.closest('.toolbox-toggle')) {
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
        if (target.classList.contains('control-button') || target.closest('.control-button') ||
            target.classList.contains('toolbox-toggle') || target.closest('.toolbox-toggle')) {
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
        this.toggleButton.removeEventListener('click', this.onToggle);
        this.holder.removeEventListener('mousedown', this.onDragStart);
        this.holder.removeEventListener('touchstart', this.onTouchStart);
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);
    }
}
