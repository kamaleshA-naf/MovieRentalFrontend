import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../services/auth.service';
import { MovieService } from '../../../services/movie.service';
import { WishlistService, WishlistItem } from '../../../services/wishlist.service';
import { RentalService } from '../../../services/rental.service';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { CarouselComponent, CarouselItem } from '../../shared/carousel/carousel';
import { catchError, of } from 'rxjs';
import { environment } from '@env/environment';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, NavbarComponent, CarouselComponent],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class WishlistComponent implements OnInit {
  auth            = inject(AuthService);
  movieService    = inject(MovieService);
  wishlistService = inject(WishlistService);
  rentalService   = inject(RentalService);
  router          = inject(Router);
  private http    = inject(HttpClient);
  private toastr  = inject(ToastrService);

  removingId      = signal<number | null>(null);
  isLoading       = signal(true);
  deletedMovieIds = signal<Set<number>>(new Set());

  private readonly API = environment.apiBase;

  readonly PLACEHOLDER = 'assets/images/placeholders/movie-placeholder.svg';

  totalCost = computed(() =>
    this.wishlistService.wishlist()
      .filter(i => !this.hasAccess(i.movieId))
      .reduce((s, i) => s + i.rentalPrice, 0)
  );

  // ALL wishlist items — no filtering, wishlist = favourites
  allWishlist = computed(() => this.wishlistService.wishlist());

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) { this.router.navigate(['/login']); return; }
    // Always reload both — ensures rented movies move to "Already Rented" section
    this.wishlistService.loadWishlist(userId);
    this.rentalService.loadMyRentals(userId);
    setTimeout(() => {
      this.isLoading.set(false);
      this.checkDeletedMovies();
    }, 500);
  }

  private checkDeletedMovies(): void {
    // Verify each wishlist movie still exists — mark deleted ones
    const items = this.wishlistService.wishlist();
    items.forEach(item => {
      this.http.get(`${this.API}/Movie/${item.movieId}`)
        .pipe(catchError(err => {
          if (err?.status === 404) {
            this.deletedMovieIds.update(s => new Set([...s, item.movieId]));
          }
          return of(null);
        }))
        .subscribe();
    });
  }

  isMovieDeleted(movieId: number): boolean {
    return this.deletedMovieIds().has(movieId);
  }

  hasAccess(movieId: number): boolean {
    return this.rentalService.hasActiveRental(movieId);
  }

  watchOrRent(item: WishlistItem): void {
    if (this.hasAccess(item.movieId)) {
      this.movieService.incrementView(item.movieId).subscribe();
      this.router.navigate(['/watch', item.movieId]);
    } else {
      this.router.navigate(['/movie', item.movieId]);
    }
  }

  viewMovie(movieId: number): void {
    this.router.navigate(['/movie', movieId]);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.PLACEHOLDER;
  }

  remove(item: WishlistItem): void {
    if (this.removingId() === item.id) return;
    this.removingId.set(item.id);
    this.wishlistService.removeFromWishlist(item.id).subscribe({
      next: () => {
        const userId = this.auth.currentUser()?.userId ?? 0;
        this.wishlistService.loadWishlist(userId);
        this.toastr.info(`"${item.movieTitle}" removed from wishlist.`, 'Wishlist');
        this.removingId.set(null);
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message ?? 'Failed to remove.', 'Error');
        this.removingId.set(null);
      }
    });
  }

  rentAll(): void {
    const first = this.wishlistService.wishlist()[0];
    if (first) this.router.navigate(['/movie', first.movieId]);
  }

  toCarouselItems(items: WishlistItem[]): CarouselItem[] {
    return items.map(i => ({
      id:        i.movieId,
      title:     i.movieTitle,
      subtitle:  `₹${i.rentalPrice}/day`,
      imageUrl:  i.thumbnailUrl,
      meta:      `Saved ${this.formatDate(i.addedDate)}`,
      badge:     this.hasAccess(i.movieId) ? 'Rented' : `₹${i.rentalPrice}`,
      badgeClass: this.hasAccess(i.movieId) ? 'badge-owned' : 'badge-price',
      _item:     i
    }));
  }

  onCarouselClick(item: CarouselItem): void {
    this.watchOrRent(item['_item'] as WishlistItem);
  }

  formatDate(d: string): string {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return d; }
  }
}