import {
  Component, Input, Output, EventEmitter,
  signal, computed, ElementRef, ViewChild,
  AfterViewInit, OnDestroy, OnChanges, SimpleChanges, NgZone, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CarouselItem {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  badge?: string;
  badgeClass?: string;
  meta?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carousel.html',
  styleUrl: './carousel.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarouselComponent implements AfterViewInit, OnDestroy, OnChanges {
  private ngZone = inject(NgZone);

  @Input() title      = '';
  @Input() badge      = '';
  @Input() badgeClass = 'carousel-badge-default';
  @Input() icon       = '';
  @Input() items: CarouselItem[] = [];
  @Input() pageSize   = 10;
  @Input() loading    = false;
  @Input() cartItems: Record<number, boolean> = {};

  @Output() cartClick  = new EventEmitter<CarouselItem>();
  @Output() loadMore   = new EventEmitter<void>();
  @Output() itemClick  = new EventEmitter<CarouselItem>();
  @Output() pageChange = new EventEmitter<number>();

  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  currentPage    = signal(0);
  readonly skeletons = Array(5).fill(0);

  // ── Infinite loop: prepend + append clones ────────────────────
  // We clone the full items array once at the front and once at the back.
  // When the user scrolls into a clone region we silently jump to the real copy.
  loopItems = computed((): CarouselItem[] => {
    const src = this.items;
    if (src.length === 0) return [];
    // [clone of all] + [real items] + [clone of all]
    return [...src, ...src, ...src];
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.items.length / this.pageSize))
  );
  pagesArray = computed(() =>
    Array.from({ length: Math.min(this.totalPages(), 10) }, (_, i) => i)
  );

  // ── Drag / touch state ────────────────────────────────────────
  private dragStartX      = 0;
  private dragStartScroll = 0;
  private isDragging      = false;
  private touchVelocity   = 0;
  private lastTouchX      = 0;
  private lastTouchTime   = 0;

  private scrollListener?:    () => void;
  private mouseMoveListener?: () => void;
  private mouseUpListener?:   () => void;

  private readonly CARD_W = 148 + 14; // card width + gap

  ngOnChanges(c: SimpleChanges): void {
    if (c['items']) {
      this.currentPage.set(0);
      // After items change, jump to the middle clone section
      setTimeout(() => this.jumpToMiddle(), 0);
    }
  }

  ngAfterViewInit(): void {
    this.jumpToMiddle();
    this.setupMouseDrag();
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    this.mouseMoveListener?.();
    this.mouseUpListener?.();
    this.scrollListener?.();
  }

  // ── Jump to the real (middle) section without animation ───────
  private jumpToMiddle(): void {
    const el = this.trackRef?.nativeElement;
    if (!el || this.items.length === 0) return;
    const middleOffset = this.items.length * this.CARD_W;
    el.scrollLeft = middleOffset;
  }

  // ── Scroll listener: detect clone regions and loop ────────────
  private setupScrollListener(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    this.ngZone.runOutsideAngular(() => {
      const onScroll = () => {
        const n     = this.items.length;
        if (n === 0) return;
        const total = n * this.CARD_W;

        // Silently jump when entering clone zones
        if (el.scrollLeft < total * 0.1) {
          // Near the front clone — jump forward by one full set
          el.scrollLeft += total;
        } else if (el.scrollLeft > total * 2.1) {
          // Near the back clone — jump back by one full set
          el.scrollLeft -= total;
        }

        // Update page dot indicator
        const realScroll = el.scrollLeft - total;
        const page = Math.round(realScroll / (this.CARD_W * this.pageSize));
        this.ngZone.run(() =>
          this.currentPage.set(Math.max(0, Math.min(page, this.totalPages() - 1)))
        );
      };

      el.addEventListener('scroll', onScroll, { passive: true });
      this.scrollListener = () => el.removeEventListener('scroll', onScroll);
    });
  }

  // ── Mouse drag ────────────────────────────────────────────────
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

  // ── Touch with momentum ───────────────────────────────────────
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

  // ── Arrow navigation ──────────────────────────────────────────
  prevPage(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: -(el.clientWidth * 0.85), behavior: 'smooth' });
  }

  nextPage(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.85, behavior: 'smooth' });
  }

  goToPage(p: number): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const middleOffset = this.items.length * this.CARD_W;
    el.scrollTo({ left: middleOffset + p * this.pageSize * this.CARD_W, behavior: 'smooth' });
    this.currentPage.set(p);
    this.pageChange.emit(p);
  }

  onImgError(e: Event): void {
    (e.target as HTMLImageElement).style.display = 'none';
  }
}
