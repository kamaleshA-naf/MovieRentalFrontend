import {
  Component, Input, Output, EventEmitter,
  signal, computed, ElementRef, ViewChild,
  AfterViewInit, OnDestroy, OnChanges, SimpleChanges, NgZone, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CarouselItem } from '../carousel/carousel';

export type { CarouselItem };

@Component({
  selector: 'app-poster-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './poster-carousel.html',
  styleUrl: './poster-carousel.css'
})
export class PosterCarouselComponent implements AfterViewInit, OnDestroy, OnChanges {
  private ngZone = inject(NgZone);

  @Input() title   = '';
  @Input() icon    = '';
  @Input() items: CarouselItem[] = [];
  @Input() loading = false;

  @Output() itemClick = new EventEmitter<CarouselItem>();

  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  readonly skeletons = Array(4).fill(0);

  visibleItems = computed(() => this.items);

  // drag state
  private isDragging      = false;
  private dragStartX      = 0;
  private dragStartScroll = 0;
  private touchVelocity   = 0;
  private lastTouchX      = 0;
  private lastTouchTime   = 0;

  private mouseMoveListener?: () => void;
  private mouseUpListener?:   () => void;

  ngOnChanges(_c: SimpleChanges): void {}

  ngAfterViewInit(): void {
    this.setupMouseDrag();
  }

  ngOnDestroy(): void {
    this.mouseMoveListener?.();
    this.mouseUpListener?.();
  }

  private setupMouseDrag(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    this.ngZone.runOutsideAngular(() => {
      const onMove = (e: MouseEvent) => {
        if (!this.isDragging) return;
        e.preventDefault();
        el.scrollLeft = this.dragStartScroll - (e.clientX - this.dragStartX);
      };
      const onUp = () => { this.isDragging = false; el.style.cursor = 'grab'; };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      this.mouseMoveListener = () => document.removeEventListener('mousemove', onMove);
      this.mouseUpListener   = () => document.removeEventListener('mouseup', onUp);
    });
  }

  onDragStart(e: MouseEvent): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    this.isDragging      = true;
    this.dragStartX      = e.clientX;
    this.dragStartScroll = el.scrollLeft;
    el.style.cursor      = 'grabbing';
  }

  onTouchStart(e: TouchEvent): void {
    this.lastTouchX    = e.touches[0].clientX;
    this.lastTouchTime = Date.now();
    this.touchVelocity = 0;
  }

  onTouchMove(e: TouchEvent): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const now = Date.now();
    const dx  = this.lastTouchX - e.touches[0].clientX;
    this.touchVelocity = dx / Math.max(1, now - this.lastTouchTime);
    this.lastTouchX    = e.touches[0].clientX;
    this.lastTouchTime = now;
    el.scrollLeft += dx;
  }

  onTouchEnd(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    let v = this.touchVelocity * 16;
    const momentum = () => {
      if (Math.abs(v) < 0.5) return;
      el.scrollLeft += v;
      v *= 0.92;
      requestAnimationFrame(momentum);
    };
    requestAnimationFrame(momentum);
  }

  scrollLeft(): void {
    this.trackRef?.nativeElement.scrollBy({ left: -320, behavior: 'smooth' });
  }

  scrollRight(): void {
    this.trackRef?.nativeElement.scrollBy({ left: 320, behavior: 'smooth' });
  }

  onImgError(e: Event): void {
    (e.target as HTMLImageElement).style.display = 'none';
  }
}
