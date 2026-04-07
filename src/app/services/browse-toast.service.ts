import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id:      number;
  type:    ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class BrowseToastService {
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: ToastType = 'info', duration = 3500): void {
    const id = Date.now();
    this.toasts.update(t => [...t, { id, type, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(msg: string) { this.show(msg, 'success'); }
  error(msg: string)   { this.show(msg, 'error');   }
  warning(msg: string) { this.show(msg, 'warning'); }

  dismiss(id: number): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
