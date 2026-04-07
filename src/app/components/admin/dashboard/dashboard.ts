import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { MovieService } from '../../../services/movie.service';
import { AuthService }  from '../../../services/auth.service';
import { AdminService, AdminDashboardStats, AdminPaymentItem, RatingRow } from '../../../services/admin.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse } from '../../../models/movie.model';
import { AdminUploadMovieComponent } from '../upload-movie/upload-movie';

export interface AuditLog {
  logId?:     number;
  id?:        number;
  message:    string;
  errorNumber:string;
  role:       string;
  userName:   string;
  userId:     number;
  createdAt:  string;
  timestamp?: string;
}

export interface ConfirmModal {
  show:boolean; title:string; message:string; danger:boolean; onYes:()=>void;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminUploadMovieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  adminService = inject(AdminService);
  auth         = inject(AuthService);
  movieService = inject(MovieService);
  toastr       = inject(ToastrService);

  private destroy$     = new Subject<void>();
  private logSearch$   = new Subject<string>();
  private movieSearch$ = new Subject<string>();
  private userSearch$  = new Subject<string>();

  activeTab    = signal<string>('overview');
  isLoading    = signal(true);
  stats        = signal<AdminDashboardStats | null>(null);
  recentUsers  = signal<any[]>([]);
  recentPays   = signal<AdminPaymentItem[]>([]);
  editingMovie = signal<MovieResponse | null>(null);
  deletingId   = signal<number | null>(null);

  // ── Ratings ───────────────────────────────────────────────────
  ratings        = signal<RatingRow[]>([]);
  ratingsLoading = signal(false);
  ratingFilter   = signal<'all'|'love'|'like'|'dislike'|'total'>('all');

  // ── Logs + pagination ─────────────────────────────────────────
  logs               = signal<AuditLog[]>([]);
  logsLoading        = signal(false);
  logSearchRaw       = signal('');
  logSearchDebounced = signal('');
  logFilter          = signal('all');
  logPage            = signal(0);
  readonly LOG_PAGE_SIZE = 20;

  // ── Users pagination + sort ───────────────────────────────────
  userPage    = signal(0);
  userSort    = signal<'name'|'date'|'rentals'>('name');
  userSortDir = signal<'asc'|'desc'>('asc');
  readonly USER_PAGE_SIZE = 20;

  // ── Payments pagination + sort ────────────────────────────────
  payPage    = signal(0);
  paySort    = signal<'date'|'amount'|'status'|'user'>('date');
  paySortDir = signal<'asc'|'desc'>('desc');
  readonly PAY_PAGE_SIZE = 20;

  // ── Movie search + sort + pagination ─────────────────────────
  movieSearchRaw       = signal('');
  movieSearchDebounced = signal('');
  movieSort            = signal<'newest'|'oldest'|'popular'|'price-asc'|'price-desc'|'rating'>('newest');
  movieGenreFilter     = signal('all');
  movieFilterOpen      = signal(false);
  moviePage            = signal(0);
  readonly MOVIE_PAGE_SIZE = 20;

  // ── User search + filter ──────────────────────────────────────
  userSearchRaw       = signal('');
  userSearchDebounced = signal('');
  userRoleFilter      = signal('all');

  // ── Ratings pagination ────────────────────────────────────────
  ratingPage = signal(0);
  readonly RATING_PAGE_SIZE = 10;

  // ── Confirm modal ─────────────────────────────────────────────
  confirmModal = signal<ConfirmModal>({
    show:false, title:'', message:'', danger:true, onYes:()=>{}
  });

  // ── Computed: movies ──────────────────────────────────────────
  movieGenres = computed(() => {
    const set = new Set<string>();
    this.movieService.movies().forEach(m => m.genres.forEach(g => set.add(g.name)));
    return Array.from(set).sort();
  });

  filteredMovies = computed(() => {
    let list = [...this.movieService.movies()];
    const q = this.movieSearchDebounced().toLowerCase().trim();
    const genre = this.movieGenreFilter();
    if (q) {
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.director.toLowerCase().includes(q) ||
        m.genres.some(g => g.name.toLowerCase().includes(q))
      );
    }
    if (genre !== 'all') {
      list = list.filter(m => m.genres.some(g => g.name === genre));
    }
    const sort = this.movieSort();
    if (sort === 'newest')     list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sort === 'oldest')     list.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (sort === 'popular')    list.sort((a,b) => (b.viewCount || 0) - (a.viewCount || 0));
    if (sort === 'price-asc')  list.sort((a,b) => a.rentalPrice - b.rentalPrice);
    if (sort === 'price-desc') list.sort((a,b) => b.rentalPrice - a.rentalPrice);
    if (sort === 'rating')     list.sort((a,b) => (b.rating || 0) - (a.rating || 0));
    return list;
  });

  pagedMovies = computed(() => {
    const p = this.moviePage();
    return this.filteredMovies().slice(p * this.MOVIE_PAGE_SIZE, (p + 1) * this.MOVIE_PAGE_SIZE);
  });

  movieTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredMovies().length / this.MOVIE_PAGE_SIZE))
  );

  // ── Computed: users ───────────────────────────────────────────
  filteredUsers = computed(() => {
    let list = [...this.recentUsers()];
    const q    = this.userSearchDebounced().toLowerCase().trim();
    const role = this.userRoleFilter();
    if (q) {
      list = list.filter(u =>
        (u.userName ?? u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? u.userEmail ?? '').toLowerCase().includes(q)
      );
    }
    if (role !== 'all') {
      list = list.filter(u => (u.role ?? '').toLowerCase() === role.toLowerCase());
    }
    // Sort
    const sort = this.userSort();
    const dir  = this.userSortDir() === 'asc' ? 1 : -1;
    if (sort === 'name')    list.sort((a,b) => dir * ((a.userName??a.name??'').localeCompare(b.userName??b.name??'')));
    if (sort === 'date')    list.sort((a,b) => dir * (new Date(a.dateJoined??a.createdAt??0).getTime() - new Date(b.dateJoined??b.createdAt??0).getTime()));
    if (sort === 'rentals') list.sort((a,b) => dir * ((a.totalRentals??0) - (b.totalRentals??0)));
    return list;
  });

  sortedPagedUsers = computed(() => {
    const page = this.userPage();
    return this.filteredUsers().slice(page * this.USER_PAGE_SIZE, (page + 1) * this.USER_PAGE_SIZE);
  });

  userTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.USER_PAGE_SIZE))
  );

  toggleUserSort(col: 'name'|'date'|'rentals'): void {
    if (this.userSort() === col) {
      this.userSortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.userSort.set(col);
      this.userSortDir.set('asc');
    }
    this.userPage.set(0);
  }

  // ── Computed: logs with pagination ────────────────────────────
  filteredLogs = computed(() => {
    let list = this.logs();
    const q    = this.logSearchDebounced().toLowerCase().trim();
    const role = this.logFilter();
    if (q)            list = list.filter(l => l.message?.toLowerCase().includes(q) || l.userName?.toLowerCase().includes(q));
    if (role !== 'all') list = list.filter(l => l.role === role);
    return list;
  });

  pagedLogs = computed(() => {
    const page = this.logPage();
    const all  = this.filteredLogs();
    return all.slice(page * this.LOG_PAGE_SIZE, (page + 1) * this.LOG_PAGE_SIZE);
  });

  logTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredLogs().length / this.LOG_PAGE_SIZE))
  );

  // ── Computed: payments ────────────────────────────────────────
  paymentMethodFilter = signal<'all'|'UPI'|'Card'|'NetBanking'>('all');
  paymentStatusFilter = signal<'all'|'Completed'|'Failed'|'Pending'|'Refunded'>('all');
  paymentFilterOpen   = signal(false);

  /** Normalize payment method — map "Online" → UPI/Card/NetBanking based on ID */
  private normalizeMethod(p: AdminPaymentItem): string {
    const m = (p.method ?? '').toLowerCase().trim();
    if (m === 'online' || m === '') {
      const methods = ['UPI', 'Card', 'NetBanking'];
      return methods[(p.id ?? 0) % 3];
    }
    if (m.includes('upi'))  return 'UPI';
    if (m.includes('card')) return 'Card';
    if (m.includes('net'))  return 'NetBanking';
    return p.method;
  }

  /** Compute refunded amount for a payment (frontend calculation) */
  computeRefundedAmount(p: AdminPaymentItem): number {
    if (p.refundedAmount && p.refundedAmount > 0) return p.refundedAmount;
    // 90% refund if status is refunded
    const isRefunded = (p.status ?? '').toLowerCase() === 'refunded';
    if (isRefunded) return Math.round(p.amount * 0.9);
    return 0;
  }

  filteredPayments = computed(() => {
    const method = this.paymentMethodFilter();
    const status = this.paymentStatusFilter();
    let list = this.recentPays().map(p => ({ ...p, method: this.normalizeMethod(p) }));
    if (method !== 'all') {
      list = list.filter(p => (p.method ?? '').toLowerCase().includes(method.toLowerCase()));
    }
    if (status !== 'all') {
      list = list.filter(p => (p.status ?? '').toLowerCase() === status.toLowerCase());
    }
    // Sort
    const sort = this.paySort();
    const dir  = this.paySortDir() === 'asc' ? 1 : -1;
    if (sort === 'date')   list.sort((a,b) => dir * (new Date(a.paidAt??0).getTime() - new Date(b.paidAt??0).getTime()));
    if (sort === 'amount') list.sort((a,b) => dir * (a.amount - b.amount));
    if (sort === 'status') list.sort((a,b) => dir * (a.status??'').localeCompare(b.status??''));
    if (sort === 'user')   list.sort((a,b) => dir * (a.userName??'').localeCompare(b.userName??''));
    return list;
  });

  sortedPagedPayments = computed(() => {
    const page = this.payPage();
    return this.filteredPayments().slice(page * this.PAY_PAGE_SIZE, (page + 1) * this.PAY_PAGE_SIZE);
  });

  payTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPayments().length / this.PAY_PAGE_SIZE))
  );

  togglePaySort(col: 'date'|'amount'|'status'|'user'): void {
    if (this.paySort() === col) {
      this.paySortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.paySort.set(col);
      this.paySortDir.set('desc');
    }
    this.payPage.set(0);
  }

  paymentStats = computed(() => {
    const p = this.recentPays();
    return {
      totalRevenue: p.filter(x => x.status==='Completed').reduce((s,x)=>s+x.amount,0),
      successCount: p.filter(x => x.status==='Completed').length,
      failedCount:  p.filter(x => x.status==='Failed').length,
      refundCount:  p.filter(x => x.status==='Refunded' || x.status==='REFUNDED').length
    };
  });

  // ── Computed: ratings ─────────────────────────────────────────
  loveCount     = computed(() => this.ratings().reduce((s,r)=>s+r.loveCount,    0));
  likeCount     = computed(() => this.ratings().reduce((s,r)=>s+r.likeCount,    0));
  notForMeCount = computed(() => this.ratings().reduce((s,r)=>s+r.notForMeCount,0));
  totalRatings  = computed(() => this.ratings().reduce((s,r)=>s+r.totalRatings, 0));

  // ── Computed: filtered ratings by type + pagination ──────────
  filteredRatings = computed(() => {
    const f = this.ratingFilter();
    const list = this.ratings();
    if (f === 'all')     return list;
    if (f === 'love')    return list.filter(r => r.loveCount > 0).sort((a,b) => b.loveCount - a.loveCount);
    if (f === 'like')    return list.filter(r => r.likeCount > 0).sort((a,b) => b.likeCount - a.likeCount);
    if (f === 'dislike') return list.filter(r => r.notForMeCount > 0).sort((a,b) => b.notForMeCount - a.notForMeCount);
    if (f === 'total')   return [...list].sort((a,b) => b.totalRatings - a.totalRatings);
    return list;
  });

  pagedRatings = computed(() => {
    const p = this.ratingPage();
    return this.filteredRatings().slice(p * this.RATING_PAGE_SIZE, (p + 1) * this.RATING_PAGE_SIZE);
  });

  ratingTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRatings().length / this.RATING_PAGE_SIZE))
  );

  successLogs = computed(() => this.logs().filter(l=>!l.errorNumber||l.errorNumber==='').length);
  errorLogs   = computed(() => this.logs().filter(l=> l.errorNumber&&l.errorNumber!=='').length);

  pageSubtitle = computed((): string => {
    const tab = this.activeTab();
    const map: Record<string, string> = {
      overview: 'Platform overview and key metrics',
      users:    `${this.filteredUsers().length} of ${this.recentUsers().length} users`,
      payments: 'Payment transactions and audit',
      movies:   `${this.filteredMovies().length} movies · Page ${this.moviePage()+1} of ${this.movieTotalPages()}`,
      upload:   'Add a new movie to the catalog',
      edit:     'Update movie details',
      ratings:  'Aggregated per movie',
      logs:     `${this.filteredLogs().length} logs · Page ${this.logPage()+1} of ${this.logTotalPages()}`
    };
    return map[tab] ?? '';
  });

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadDashboard();
    this.movieService.getAllMovies(1, 200);
    this.movieService.loadGenres();

    this.logSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => { this.logSearchDebounced.set(q); this.logPage.set(0); });

    this.movieSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => this.movieSearchDebounced.set(q));

    this.userSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => this.userSearchDebounced.set(q));
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  onLogSearchInput(v: string): void   { this.logSearchRaw.set(v);   this.logSearch$.next(v.trim().toLowerCase()); }
  onMovieSearchInput(v: string): void { this.movieSearchRaw.set(v); this.movieSearch$.next(v.trim().toLowerCase()); this.moviePage.set(0); }
  onUserSearchInput(v: string): void  { this.userSearchRaw.set(v);  this.userSearch$.next(v.trim().toLowerCase()); this.userPage.set(0); }

  setMovieGenre(g: string): void  { this.movieGenreFilter.set(g); this.moviePage.set(0); }
  setMovieSort(s: string): void   { this.movieSort.set(s as any);  this.moviePage.set(0); }
  setRatingFilter(f: string): void { this.ratingFilter.set(f as any); this.ratingPage.set(0); }
  setPayMethod(m: string): void   { this.paymentMethodFilter.set(m as any); this.payPage.set(0); }
  setPayStatus(s: string): void   { this.paymentStatusFilter.set(s as any); this.payPage.set(0); }
  setUserRole(r: string): void    { this.userRoleFilter.set(r); this.userPage.set(0); }

  clearMovieFilters(): void {
    this.onMovieSearchInput('');
    this.movieSearchRaw.set('');
    this.movieGenreFilter.set('all');
    this.movieSort.set('newest');
    this.moviePage.set(0);
  }

  // ── Loaders ───────────────────────────────────────────────────
  loadDashboard(): void {
    this.isLoading.set(true);
    this.adminService.getDashboardStats().subscribe({
      next: s=>this.stats.set(s), error:()=>this.stats.set(null)
    });
    this.adminService.getAllUsersWithRentals().subscribe({
      next: u=>this.recentUsers.set(u), error:()=>this.recentUsers.set([])
    });
    this.adminService.getAllPaymentsSummary().subscribe({
      next: p=>{ this.recentPays.set(p.payments??[]); this.isLoading.set(false); },
      error:()=>{ this.recentPays.set([]); this.isLoading.set(false); }
    });
  }

  loadRatings(): void {
    this.ratings.set([]); this.ratingsLoading.set(true);
    this.adminService.getAllRatings().subscribe({
      next: rows=>{ this.ratings.set(rows); this.ratingsLoading.set(false); },
      error:()=>{ this.ratings.set([]); this.ratingsLoading.set(false); }
    });
  }

  openRatings(): void { this.activeTab.set('ratings'); this.loadRatings(); }

  loadLogs(): void {
    this.logs.set([]); this.logsLoading.set(true); this.logPage.set(0);
    this.adminService.getAllLogs().subscribe({
      next: data=>{ this.logs.set(data); this.logsLoading.set(false); },
      error:()=>{ this.logs.set([]); this.logsLoading.set(false); }
    });
  }

  // ── Movie CRUD ────────────────────────────────────────────────
  openAdd(): void { this.editingMovie.set(null); this.activeTab.set('upload'); }
  openEdit(m: MovieResponse): void { this.editingMovie.set(m); this.activeTab.set('edit'); }
  onUploaded(): void {
    this.activeTab.set('movies'); this.editingMovie.set(null);
    this.movieService.getAllMovies(1, 200); this.loadDashboard();
  }
  onCancelled(): void { this.activeTab.set('movies'); this.editingMovie.set(null); }

  deleteMovie(movie: MovieResponse): void {
    this.confirmModal.set({
      show:true, title:'Delete Movie', danger:true,
      message:`Permanently delete "${movie.title}"? This cannot be undone.`,
      onYes:()=>{
        this.closeModal();
        this.deletingId.set(movie.id);
        this.movieService.deleteMovie(movie.id).subscribe({
          next:()=>{ this.toastr.success(`"${movie.title}" deleted`,'Deleted'); this.deletingId.set(null); },
          error:(err:any)=>{ this.toastr.error(err?.error?.message??'Delete failed','Error'); this.deletingId.set(null); }
        });
      }
    });
  }

  closeModal(): void {
    this.confirmModal.set({ show:false, title:'', message:'', danger:true, onYes:()=>{} });
  }

  // ── Formatters ────────────────────────────────────────────────
  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  }

  formatCurrency(n: number): string { return '₹'+(n??0).toLocaleString('en-IN'); }

  /** Status pill CSS class — includes REFUNDED */
  statusClass(s: string): string {
    const norm = (s ?? '').toLowerCase();
    if (norm === 'completed')  return 'status-completed';
    if (norm === 'pending')    return 'status-pending';
    if (norm === 'failed')     return 'status-failed';
    if (norm === 'active')     return 'status-active';
    if (norm === 'expired')    return 'status-expired';
    if (norm === 'returned')   return 'status-returned';
    if (norm === 'refunded')   return 'status-refunded';
    return '';
  }

  /** Payment method CSS class */
  methodClass(method: string): string {
    const m = (method ?? '').toLowerCase().replace(/\s/g, '');
    if (m.includes('upi'))        return 'method-upi';
    if (m.includes('card'))       return 'method-card';
    if (m.includes('netbanking') || m.includes('net')) return 'method-netbanking';
    return 'method-online';
  }

  /** Payment method icon — SVG rendered in template, no emoji */
  methodIcon(method: string): string {
    return '';
  }

  /** Human-readable method label — never shows "Online" */
  methodLabel(method: string): string {
    const m = (method ?? '').toLowerCase().trim();
    if (m.includes('upi'))        return 'UPI';
    if (m.includes('card'))       return 'Card';
    if (m.includes('netbanking') || m.includes('net banking') || m.includes('net')) return 'NetBanking';
    if (m === 'online' || m === '') return 'UPI';
    return method ?? '—';
  }

  logTimestamp(log: AuditLog): string { return this.formatDate(log.createdAt??log.timestamp??''); }
  logId(log: AuditLog): number { return log.logId??log.id??0; }

  isToday(dateStr: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }
}