import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { MovieService } from '../../../services/movie.service';
import { RentalService } from '../../../services/rental.service';
import { WishlistService } from '../../../services/wishlist.service';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { CarouselComponent, CarouselItem } from '../../shared/carousel/carousel';

type Tab = 'overview' | 'rentals' | 'wishlist' | 'transactions';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, CarouselComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  auth            = inject(AuthService);
  movieService    = inject(MovieService);
  rentalService   = inject(RentalService);
  wishlistService = inject(WishlistService);
  router          = inject(Router);   // public — used in template

  activeTab  = signal<Tab>('overview');
  isLoading  = signal(true);
  txnLoading = computed(() => this.rentalService.paymentsLoading());

  // ── Rental slices ─────────────────────────────────────────
  activeRentals = computed(() =>
    this.rentalService.myRentals().filter(r => r.status === 'Active')
  );
  expiredRentals = computed(() =>
    this.rentalService.myRentals().filter(r => r.status === 'Expired')
  );
  returnedRentals = computed(() =>
    this.rentalService.myRentals().filter(r => r.status === 'Returned')
  );

  // ── Transactions ──────────────────────────────────────────
  transactions = computed(() =>
    this.rentalService.myPayments().map(p => ({
      txnId:      `TXN${p.id.toString().padStart(9, '0')}`,
      movieTitle: p.movieTitle || '—',
      status:     p.status,   // 'Completed' | 'Refunded' | 'Failed'
      amount:     p.amount,
      method:     p.method || '—',
      date:       p.paidAt,
    }))
  );

  txnStatusFilter = signal<string>('all');
  txnSort         = signal<'newest' | 'oldest'>('newest');
  txnSortOpen     = signal(false);

  filteredTxns = computed(() => {
    const status = this.txnStatusFilter();
    const sort   = this.txnSort();
    let list = this.transactions();
    if (status !== 'all') {
      list = list.filter(t => t.status.toLowerCase() === status.toLowerCase());
    }
    return [...list].sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sort === 'newest' ? diff : -diff;
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) { this.router.navigate(['/login']); return; }
    this.rentalService.loadMyRentals(userId);
    this.wishlistService.loadWishlist(userId);
    if (this.movieService.movies().length === 0) this.movieService.getAllMovies();
    setTimeout(() => this.isLoading.set(false), 400);
  }

  // ── Helpers ───────────────────────────────────────────────
  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  daysRemaining(expiryDate: string): number {
    return this.rentalService.daysRemaining(expiryDate);
  }

  progressPct(expiryDate: string, rentalDate: string): number {
    const total   = new Date(expiryDate).getTime() - new Date(rentalDate).getTime();
    const elapsed = Date.now() - new Date(rentalDate).getTime();
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }

  watchMovie(movieId: number): void {
    this.movieService.incrementView(movieId).subscribe();
    this.router.navigate(['/watch', movieId]);
  }

  viewMovie(movieId: number): void {
    this.router.navigate(['/movie', movieId]);
  }

  // ── Carousel mappers ──────────────────────────────────────
  rentalsToCarousel(): CarouselItem[] {
    const movies = this.movieService.movies();
    return this.rentalService.myRentals().map(r => {
      const movie = movies.find(m => m.id === r.movieId);
      return {
        id:         r.movieId,
        title:      r.movieTitle,
        subtitle:   r.status,
        imageUrl:   movie?.thumbnailUrl ?? null,
        meta:       `Expires ${this.formatDate(r.expiryDate)}`,
        badge:      r.status,
        badgeClass: r.status === 'Active'  ? 'badge-active'
                  : r.status === 'Expired' ? 'badge-expired'
                  : 'badge-returned',
        _movieId:   r.movieId,
        _status:    r.status
      };
    });
  }

  wishlistToCarousel(): CarouselItem[] {
    return this.wishlistService.wishlist().map(w => ({
      id:         w.movieId,
      title:      w.movieTitle,
      subtitle:   `₹${w.rentalPrice}/day`,
      imageUrl:   w.thumbnailUrl,
      meta:       `Saved ${this.formatDate(w.addedDate)}`,
      badge:      `₹${w.rentalPrice}`,
      badgeClass: 'badge-price',
      _movieId:   w.movieId
    }));
  }

  onRentalCarouselClick(item: CarouselItem): void {
    if (item['_status'] === 'Active') this.watchMovie(item['_movieId'] as number);
    else this.viewMovie(item['_movieId'] as number);
  }

  onWishlistCarouselClick(item: CarouselItem): void {
    this.viewMovie(item['_movieId'] as number);
  }
}
