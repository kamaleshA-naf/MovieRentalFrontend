import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';
import { MovieRowComponent } from '../movie-row/movie-row';
import { AzBrowserComponent } from '../az-browser/az-browser';
import { CategoryPanelComponent } from '../category-panel/category-panel';
import { BrowseNavbarComponent } from '../browse-navbar/browse-navbar';
import { BrowseToastComponent } from '../toast/browse-toast';
import { BrowseMovie } from '../../../models/browse.model';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-browse-home',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
    MovieRowComponent,
    AzBrowserComponent,
    CategoryPanelComponent,
    BrowseNavbarComponent,
    BrowseToastComponent,
  ],
  templateUrl: './browse-home.html',
  styleUrl: './browse-home.css'
})
export class BrowseHomeComponent {
  store = inject(BrowseStore);
  toast = inject(BrowseToastService);

  showPanel      = signal(false);
  activeCategory = signal('');
  searchQuery    = signal('');

  // Infinite scroll state
  private visibleCount = signal(PAGE_SIZE);
  isLoadingMore = signal(false);

  // ── Search ─────────────────────────────────────────────────────
  isSearching = computed(() => this.searchQuery().trim().length > 0);

  searchResults = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return [];
    return this.store.movies().filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q) ||
      m.language.toLowerCase().includes(q) ||
      m.genres.some(g => g.toLowerCase().includes(q))
    );
  });

  // ── Category filter ────────────────────────────────────────────
  categoryMovies = computed((): BrowseMovie[] => {
    const cat = this.activeCategory();
    if (!cat) return [];
    if (cat === 'trending') return this.store.trending();
    if (cat === 'south')    return this.store.southIndian();
    if (cat === 'mylist')   return this.store.myListMovies();
    if (cat === 'az')       return [];
    if (cat.startsWith('lang:'))  return this.store.moviesForLanguage(cat.slice(5));
    if (cat.startsWith('genre:')) return this.store.moviesForGenre(cat.slice(6));
    return [];
  });

  categoryLabel = computed(() => {
    const cat = this.activeCategory();
    if (!cat) return '';
    if (cat === 'trending') return '🔥 Trending';
    if (cat === 'south')    return '🎬 South Indian Cinema';
    if (cat === 'mylist')   return '❤ My List';
    if (cat.startsWith('lang:'))  return cat.slice(5);
    if (cat.startsWith('genre:')) return cat.slice(6);
    return '';
  });

  isAzMode    = computed(() => this.activeCategory() === 'az');
  showDefault = computed(() => !this.isSearching() && !this.activeCategory());

  // ── Paginated category movies (infinite scroll) ────────────────
  visibleCategoryMovies = computed(() =>
    this.categoryMovies().slice(0, this.visibleCount())
  );

  hasMore = computed(() =>
    this.visibleCount() < this.categoryMovies().length
  );

  // ── Hero movie (first trending, fallback to first movie) ───────
  heroMovie = computed(() =>
    this.store.trending()[0] ?? this.store.movies()[0] ?? null
  );

  onCategorySelect(key: string): void {
    this.activeCategory.set(key);
    this.visibleCount.set(PAGE_SIZE);
    this.showPanel.set(false);
  }

  onSearch(q: string): void {
    this.searchQuery.set(q);
    this.activeCategory.set('');
    this.visibleCount.set(PAGE_SIZE);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.hasMore() || this.isLoadingMore()) return;
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    if (scrolled >= total - 300) {
      this.loadMore();
    }
  }

  loadMore(): void {
    if (!this.hasMore() || this.isLoadingMore()) return;
    this.isLoadingMore.set(true);
    setTimeout(() => {
      this.visibleCount.update(n => n + PAGE_SIZE);
      this.isLoadingMore.set(false);
    }, 300);
  }
}
