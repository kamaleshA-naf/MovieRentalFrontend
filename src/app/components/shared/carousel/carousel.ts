import {
  Component, Input, Output, EventEmitter,
  signal, computed, ElementRef, ViewChild,
  AfterViewInit, OnDestroy, OnChanges, SimpleChanges, NgZone, inject
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
  styleUrl: './carousel.css'
})
export class CarouselComponent implements AfterViewInit, OnDestroy, OnChanges {
  private ngZone = inject(NgZone);

  @Input() title             = '';
  @Input() badge             = '';
  @Input() badgeClass        = 'carousel-badge-default';
  @Input() icon              = '';
  @Input() items: CarouselItem[] = [];
  @Input() pageSize          = 10;
  @Input() loading           = false;
  @Input() hasOverlayContent = false;
  /** Map of item id → true when that item is already in cart */
  @Input() cartItems: Record<number, boolean> = {};
  /** Emit when user clicks the + cart button on a card */
  @Output() cartClick  = new EventEmitter<CarouselItem>();
  /** Emit when user scrolls near the end — parent should append more items */
  @Output() loadMore   = new EventEmitter<void>();
  @Output() itemClick  = new EventEmitter<CarouselItem>();
  @Output() pageChange = new EventEmitter<number>();

  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  currentPage    = signal(0);
  loadingMore    = signal(false);
  readonly skeletons = Array(5).fill(0);

  // All items are shown — no slicing. Parent appends via [items] input.
  visibleItems = computed(() => this.items);

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.items.length / this.pageSize))
  );

  pagesArray = computed(() =>
    Array.from({ length: Math.min(this.totalPages(), 10) }, (_, i) => i)
  );

  // Drag / touch state
  private dragStartX      = 0;
  private dragStartScroll = 0;
  private isDragging      = false;
  private touchStartX     = 0;
  private touchVelocity   = 0;
  private lastTouchX      = 0;
  private lastTouchTime   = 0;

  // Scroll listener cleanup
  private scrollListener?: () => void;
  private mouseMoveListener?: () => void;
  private mouseUpListener?: () => void;

  ngOnChanges(c: SimpleChanges): void {
    // When items first arrive, reset page; when more are appended, keep position
    if (c['items']?.firstChange) {
      this.currentPage.set(0);
    }
    // Clear loading-more state once new items arrive
    if (c['items'] && !c['items'].firstChange) {
      this.loadingMore.set(false);
    }
  }

  ngAfterViewInit(): void {
    this.setupMouseDrag();
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    this.mouseMoveListener?.();
    this.mouseUpListener?.();
    this.scrollListener?.();
  }

  // ── Scroll-based infinite load ────────────────────────────────
  private setupScrollListener(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;

    this.ngZone.runOutsideAngular(() => {
      const onScroll = () => {
        // Update current page indicator
        const cardWidth = 148 + 14; // card width + gap
        const page = Math.round(el.scrollLeft / (cardWidth * this.pageSize));
        this.ngZone.run(() => this.currentPage.set(page));

        // Trigger load-more when within 200px of right edge
        const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 200;
        if (nearEnd && !this.loadingMore()) {
          this.ngZone.run(() => {
            this.loadingMore.set(true);
            this.loadMore.emit();
          });
        }
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
        const dx = e.clientX - this.dragStartX;
        el.scrollLeft = this.dragStartScroll - dx;
      };
      const onUp = () => {
        this.isDragging = false;
        el.style.cursor = 'grab';
      };

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
    this.touchStartX   = e.touches[0].clientX;
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
    // Momentum scroll
    let velocity = this.touchVelocity * 16;
    const momentum = () => {
      if (Math.abs(velocity) < 0.5) return;
      el.scrollLeft += velocity;
      velocity *= 0.92;
      requestAnimationFrame(momentum);
    };
    requestAnimationFrame(momentum);
  }

  // ── Arrow navigation ──────────────────────────────────────────
  prevPage(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.85;
    el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }

  nextPage(): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.85;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  goToPage(p: number): void {
    const el = this.trackRef?.nativeElement;
    if (!el) return;
    const cardWidth = 148 + 14;
    el.scrollTo({ left: p * this.pageSize * cardWidth, behavior: 'smooth' });
    this.currentPage.set(p);
    this.pageChange.emit(p);
  }

  onImgError(e: Event): void {
    (e.target as HTMLImageElement).style.display = 'none';
  }
}
