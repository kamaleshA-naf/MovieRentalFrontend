import {
  Component, inject, signal, computed,
  OnInit, OnDestroy, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink }    from '@angular/router';
import { FormsModule }   from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { MovieService }  from '../../../services/movie.service';
import { RentalService } from '../../../services/rental.service';
import { AuthService }   from '../../../services/auth.service';
import { CartService }   from '../../../services/cart.service';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { CarouselComponent, CarouselItem } from '../../shared/carousel/carousel';
import { MovieResponse, GenreResponse } from '../../../models/movie.model';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

const SOUTH_INDIAN_LANGS = ['Tamil', 'Telugu', 'Malayalam', 'Kannada'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NavbarComponent, CarouselComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  movieService  = inject(MovieService);
  rentalService = inject(RentalService);
  cartService   = inject(CartService);
  auth          = inject(AuthService);
  private toastr = inject(ToastrService);
  private ngZone = inject(NgZone);
  private router = inject(Router);

  searchQuery     = signal('');
  debouncedSearch = signal('');
  selectedGenre   = signal('All');
  selectedLanguage = signal('');
  addingToCart    = signal<number | null>(null);
  isSearching     = signal(false);
  searchPanelOpen = signal(false);

  // Infinite scroll
  visibleCount    = signal(20);
  isLoadingMore   = signal(false);
  private scrollSentinel: HTMLElement | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  // A-Z filter
  readonly alphabet    = ALPHABET;
  selectedLetter       = signal('');

  private searchInput$ = new Subject<string>();
  private destroy$     = new Subject<void>();

  readonly PLACEHOLDER = 'assets/images/placeholders/movie-placeholder.svg';

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 200);
    this.movieService.loadGenres();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (userId > 0) {
      this.rentalService.loadMyRentals(userId);
      this.cartService.loadCart(userId);
    }

    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(q => {
      this.debouncedSearch.set(q);
      this.isSearching.set(false);
      this.visibleCount.set(20); // reset on new search
    });

    // Setup infinite scroll sentinel after view stabilises
    setTimeout(() => this.setupInfiniteScroll(), 600);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.intersectionObserver?.disconnect();
  }

  private setupInfiniteScroll(): void {
    this.scrollSentinel = document.getElementById('scroll-sentinel');
    if (!this.scrollSentinel) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.isLoadingMore()) {
          this.ngZone.run(() => this.loadMore());
        }
      },
      { rootMargin: '200px' }
    );
    this.intersectionObserver.observe(this.scrollSentinel);
  }

  loadMore(): void {
    const total = this.filteredMovies().length;
    if (this.visibleCount() >= total) return;
    this.isLoadingMore.set(true);
    setTimeout(() => {
      this.visibleCount.update(v => Math.min(v + 20, total));
      this.isLoadingMore.set(false);
    }, 300);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.isSearching.set(value.length > 0);
    this.searchInput$.next(value.trim().toLowerCase());
  }

  openSearchPanel(): void { this.searchPanelOpen.set(true); }
  closeSearchPanel(): void {
    this.searchPanelOpen.set(false);
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.debouncedSearch.set('');
    this.isSearching.set(false);
    this.selectedLetter.set('');
    this.selectedLanguage.set('');
    this.visibleCount.set(20);
    this.searchInput$.next('');
  }

  selectLanguage(lang: string): void {
    // Toggle — click same language again to deselect
    this.selectedLanguage.set(this.selectedLanguage() === lang ? '' : lang);
    this.searchQuery.set('');
    this.debouncedSearch.set('');
    this.selectedLetter.set('');
    this.selectedGenre.set('All');
  }

  selectLetter(l: string): void {
    this.selectedLetter.set(this.selectedLetter() === l ? '' : l);
    this.debouncedSearch.set('');
    this.searchQuery.set('');
    this.selectedGenre.set('All');
  }

  // Show all movies from signal
  allMovies = computed(() => this.movieService.movies());

  // Trending: live signal sorted by viewCount — refreshed from API on init
  trendingMovies = computed(() =>
    [...this.allMovies()]
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 15)
  );

  featuredMovie = computed(() => {
    const movies = this.allMovies();
    return movies.find((m: MovieResponse) => m.thumbnailUrl) ?? movies[0] ?? null;
  });

  heroBg = computed(() => {
    const m = this.featuredMovie();
    return m?.thumbnailUrl ? `url(${m.thumbnailUrl})` : '';
  });

  genres = computed(() => {
    const set = new Set<string>(['All']);
    this.allMovies().forEach((m: MovieResponse) =>
      m.genres.forEach((g: GenreResponse) => set.add(g.name))
    );
    return Array.from(set);
  });

  // Unique languages present in movie data
  activeLanguages = computed<string[]>(() => {
    const langs = new Set<string>();
    this.allMovies().forEach(m => {
      if ((m as any).language) langs.add((m as any).language);
    });
    return Array.from(langs);
  });

  // Unique genres present in movie data
  activeGenres = computed<string[]>(() => {
    const set = new Set<string>();
    this.allMovies().forEach(m =>
      m.genres.forEach(g => set.add(g.name))
    );
    return Array.from(set);
  });

  greeting = computed(() => {
    const h    = new Date().getHours();
    const name = this.auth.currentUser()?.userName ?? '';
    if (h < 12) return `Good morning, ${name}`;
    if (h < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  });

  filteredMovies = computed(() => {
    let list = this.allMovies();
    const q    = this.debouncedSearch();
    const g    = this.selectedGenre();
    const l    = this.selectedLetter();
    const lang = this.selectedLanguage();

    // A-Z letter filter
    if (l) return list.filter(m => m.title.toUpperCase().startsWith(l));

    // Language filter — exact match on language field
    if (lang) {
      list = list.filter(m =>
        ((m as any).language ?? '').toLowerCase() === lang.toLowerCase()
      );
    }

    // Text search — title, director, description, genre, language
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((m: MovieResponse) =>
        m.title.toLowerCase().includes(ql) ||
        m.director.toLowerCase().includes(ql) ||
        (m.description ?? '').toLowerCase().includes(ql) ||
        ((m as any).language ?? '').toLowerCase().includes(ql) ||
        m.genres.some((genre: GenreResponse) => genre.name.toLowerCase().includes(ql))
      );
    }

    // Genre filter
    if (g !== 'All') {
      list = list.filter((m: MovieResponse) =>
        m.genres.some((genre: GenreResponse) => genre.name === g)
      );
    }

    return list;
  });

  isFilterMode = computed(() =>
    this.debouncedSearch().length > 0 ||
    this.selectedGenre() !== 'All' ||
    this.selectedLetter().length > 0 ||
    this.selectedLanguage().length > 0
  );

  // Paginated slice for infinite scroll in filter/search mode
  visibleMovies = computed(() =>
    this.filteredMovies().slice(0, this.visibleCount())
  );

  // ── Sections ──────────────────────────────────────────────────

  // Most Loved: sorted by rating desc (highest rated = most loved by customers)
  mostLovedMovies = computed(() =>
    [...this.allMovies()]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 10)
  );

  top10Movies = computed(() =>
    [...this.allMovies()]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 10)
  );

  newMovies = computed(() =>
    [...this.allMovies()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15)
  );

  southIndianMovies = computed(() =>
    this.allMovies().filter(m =>
      SOUTH_INDIAN_LANGS.includes((m as any).language ?? '')
    ).slice(0, 15)
  );

  moviesForLanguage(lang: string): MovieResponse[] {
    return this.allMovies()
      .filter(m => (m as any).language === lang)
      .slice(0, 15);
  }

  moviesForGenre(genre: string): MovieResponse[] {
    return this.allMovies()
      .filter(m => m.genres.some(g => g.name === genre))
      .slice(0, 15);
  }

  hasMoviesForLetter(l: string): boolean {
    return this.allMovies().some(m => m.title.toUpperCase().startsWith(l));
  }

  // ── Cart / Access ──────────────────────────────────────────────

  hasAccess(movieId: number): boolean {
    return this.rentalService.hasActiveRental(movieId);
  }

  isInCart(movieId: number): boolean {
    return this.cartService.isInCart(movieId);
  }

  // Map of movieId → inCart for carousel [cartItems] input
  cartItemsMap = computed<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {};
    this.allMovies().forEach(m => {
      if (this.cartService.isInCart(m.id)) map[m.id] = true;
    });
    return map;
  });

  addToCart(event: Event, movie: MovieResponse): void {
    event.stopPropagation();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId || this.addingToCart() === movie.id) return;
    if (this.cartService.isInCart(movie.id)) {
      this.toastr.warning(`"${movie.title}" is already in your cart.`, 'Already in Cart');
      return;
    }
    this.addingToCart.set(movie.id);
    this.cartService.addToCart({ userId, movieId: movie.id, durationDays: 7 }).subscribe({
      next: () => {
        this.cartService.loadCart(userId);
        this.addingToCart.set(null);
        this.toastr.success(`"${movie.title}" added to cart!`, 'Added 🛒');
      },
      error: (err: any) => {
        this.addingToCart.set(null);
        if (err?.status === 409) {
          this.cartService.loadCart(userId);
          this.toastr.warning(`"${movie.title}" is already in your cart.`, 'Already in Cart');
        } else {
          this.toastr.error(err?.error?.message ?? 'Could not add to cart.', 'Error');
        }
      }
    });
  }

  posterUrl(movie: MovieResponse): string {
    return movie.thumbnailUrl ?? this.PLACEHOLDER;
  }

  // ── Carousel page-based navigation ────────────────────────────
  // Each row key maps to its current page index (0-based)
  private carouselPages = new Map<string, number>();
  readonly CAROUSEL_PAGE_SIZE = 10;

  /** Get the current page for a named carousel row */
  getCarouselPage(key: string): number {
    return this.carouselPages.get(key) ?? 0;
  }

  /** Get the visible slice for a named carousel row from a source array */
  getCarouselSlice(key: string, source: MovieResponse[]): MovieResponse[] {
    if (!source.length) return [];
    const page  = this.getCarouselPage(key);
    const size  = this.CAROUSEL_PAGE_SIZE;
    const total = source.length;
    const start = (page * size) % total;
    // Wrap-around: if slice would exceed end, concat from beginning
    const end = start + size;
    if (end <= total) return source.slice(start, end);
    return [...source.slice(start, total), ...source.slice(0, end - total)];
  }

  /** Advance carousel to next page (circular) */
  carouselNext(key: string, source: MovieResponse[]): void {
    if (!source.length) return;
    const totalPages = Math.ceil(source.length / this.CAROUSEL_PAGE_SIZE);
    const cur = this.getCarouselPage(key);
    this.carouselPages.set(key, (cur + 1) % totalPages);
  }

  /** Go back one page (circular) */
  carouselPrev(key: string, source: MovieResponse[]): void {
    if (!source.length) return;
    const totalPages = Math.ceil(source.length / this.CAROUSEL_PAGE_SIZE);
    const cur = this.getCarouselPage(key);
    this.carouselPages.set(key, (cur - 1 + totalPages) % totalPages);
  }

  scroll(el: HTMLElement, dir: 'left' | 'right'): void {
    const scrollAmount = 680;
    if (dir === 'right') {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    } else {
      if (el.scrollLeft <= 10) {
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
    }
  }

  trackById(_: number, movie: MovieResponse): number {
    return movie.id;
  }

  /** Convert MovieResponse[] → CarouselItem[] for the carousel component */
  toCarouselItems(movies: MovieResponse[]): CarouselItem[] {
    return movies.map(m => ({
      id:        m.id,
      title:     m.title,
      subtitle:  m.director,
      imageUrl:  m.thumbnailUrl,
      meta:      String(m.releaseYear),
      badge:     this.rentalService.hasActiveRental(m.id) ? 'Owned' : `₹${m.rentalPrice}`,
      badgeClass: this.rentalService.hasActiveRental(m.id) ? 'badge-owned' : 'badge-price',
      _movie:    m
    }));
  }

  onCarouselClick(item: CarouselItem): void {
    this.router.navigate(['/movie', item.id]);
  }

  onCarouselCartClick(item: CarouselItem): void {
    this.addToCart(new MouseEvent('click'), item['_movie'] as MovieResponse);
  }

  // ── Per-row infinite scroll state ────────────────────────────
  // key → { page, hasMore, items }
  private rowState = new Map<string, { page: number; hasMore: boolean; items: MovieResponse[] }>();

  /** Get accumulated items for a named row (falls back to source array) */
  getRowItems(key: string, source: MovieResponse[]): MovieResponse[] {
    return this.rowState.get(key)?.items ?? source;
  }

  /** Called by carousel (loadMore) output — fetches next page and appends */
  onCarouselLoadMore(key: string): void {
    const state = this.rowState.get(key);
    const nextPage = (state?.page ?? 1) + 1;
    if (state && !state.hasMore) return;

    this.movieService.getMoviesPage(nextPage, 10).subscribe({
      next: ({ items, hasMore }) => {
        const existing = this.rowState.get(key)?.items ?? [];
        const existingIds = new Set(existing.map(m => m.id));
        const newItems = items.filter(m => !existingIds.has(m.id));
        this.rowState.set(key, { page: nextPage, hasMore, items: [...existing, ...newItems] });
      }
    });
  }

  /** Initialise a row with its first page of data */
  initRow(key: string, source: MovieResponse[]): MovieResponse[] {
    if (!this.rowState.has(key)) {
      this.rowState.set(key, { page: 1, hasMore: true, items: source });
    }
    return this.rowState.get(key)!.items;
  }
}
