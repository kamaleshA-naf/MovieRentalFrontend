import {
  Component, inject, signal, computed, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { MovieService } from '../../../services/movie.service';
import { RentalService } from '../../../services/rental.service';
import { CartService } from '../../../services/cart.service';
import { WishlistService } from '../../../services/wishlist.service';
import { MovieRatingComponent } from '../../shared/movie-rating/movie-rating';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { MovieResponse } from '../../../models/movie.model';
import { environment } from '@env/environment';

@Component({
  selector: 'app-movie-detail',
  standalone: true,
  imports: [CommonModule, NavbarComponent, MovieRatingComponent],
  templateUrl: './movie-detail.html',
  styleUrl: './movie-detail.css'
})
export class MovieDetailComponent implements OnInit {
  private readonly API = environment.apiBase;
  readonly PLACEHOLDER = 'assets/images/placeholders/movie-placeholder.svg';

  auth            = inject(AuthService);
  movieService    = inject(MovieService);
  rentalService   = inject(RentalService);
  cartService     = inject(CartService);
  wishlistService = inject(WishlistService);
  router          = inject(Router);
  route           = inject(ActivatedRoute);
  toastr          = inject(ToastrService);
  private http    = inject(HttpClient);

  movie            = signal<MovieResponse | null>(null);
  isLoading        = signal(true);
  notFound         = signal(false);
  movieDeleted     = signal(false);
  showRentModal    = signal(false);
  showPaySuccess   = signal(false);
  isRenting        = signal(false);
  isAddingCart     = signal(false);
  isTogglingWish   = signal(false);
  selectedDuration = signal(3);
  paidAmount       = signal(0);
  userRating       = signal(0);
  activeRental     = signal<any | null>(null);
  expiredRental    = signal<any | null>(null);
  returnedRental   = signal<any | null>(null);

  readonly durations = [1, 3, 7, 14, 30];

  hasAccess = computed(() => {
    const r = this.activeRental();
    if (!r) return false;
    return new Date(r.expiryDate ?? r.endDate ?? r.ExpiryDate ?? 0) > new Date();
  });

  isExpired = computed(() => !!this.expiredRental() && !this.hasAccess());
  isReturned = computed(() => !!this.returnedRental());

  daysLeft = computed(() => {
    const r = this.activeRental();
    if (!r) return 0;
    const diff = new Date(r.expiryDate ?? r.endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  });

  isInWishlist = computed(() =>
    this.wishlistService.isInWishlist(this.movie()?.id ?? 0)
  );

  isInCart = computed(() =>
    this.cartService.isInCart(this.movie()?.id ?? 0)
  );

  totalCost = computed(() =>
    (this.movie()?.rentalPrice ?? 0) * this.selectedDuration()
  );

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.router.navigate(['/home']); return; }

    const userId = this.auth.currentUser()?.userId;
    if (userId) {
      this.wishlistService.loadWishlist(userId);
      this.cartService.loadCart(userId);
    }

    this.movieService.getMovieById(id).subscribe({
      next: (m) => {
        this.movie.set(m);
        this.isLoading.set(false);
        this.loadRentalState(id);
        this.loadUserRating(id);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err?.status === 404) {
          this.movieDeleted.set(true);
        } else {
          this.notFound.set(true);
          setTimeout(() => this.router.navigate(['/home']), 2500);
        }
      }
    });
  }

  private loadRentalState(movieId: number): void {
    const userId = this.auth.currentUser()?.userId;
    if (!userId) return;

    this.http.get<any[]>(`${this.API}/Rental/user/${userId}`)
      .pipe(catchError(() => of([])))
      .subscribe(rentals => {
        const all = Array.isArray(rentals) ? rentals : [];
        const active  = all.find((r: any) =>
          r.movieId === movieId &&
          new Date(r.expiryDate ?? r.endDate ?? r.ExpiryDate ?? 0) > new Date() &&
          r.status !== 'Returned'
        );
        const returned = all.find((r: any) =>
          r.movieId === movieId && r.status === 'Returned'
        );
        const expired = all.find((r: any) =>
          r.movieId === movieId &&
          new Date(r.expiryDate ?? r.endDate ?? r.ExpiryDate ?? 0) <= new Date() &&
          r.status !== 'Returned'
        );
        this.activeRental.set(active ?? null);
        this.returnedRental.set(active ? null : (returned ?? null));
        this.expiredRental.set(active ? null : (returned ? null : (expired ?? null)));
      });
  }

  private loadUserRating(movieId: number): void {
    const userId = this.auth.currentUser()?.userId;
    if (!userId) return;
    this.http.get<any>(`${this.API}/Movie/${movieId}/rating/user/${userId}`)
      .pipe(catchError(() => of({ ratingValue: 0 })))
      .subscribe(r => this.userRating.set(r?.ratingValue ?? 0));
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${this.auth.getToken?.() ?? ''}`
    });
  }

  poster(url: string | null | undefined): string {
    return url || this.PLACEHOLDER;
  }

  watchNow(): void {
    const m = this.movie();
    if (!m) return;
    if (!this.hasAccess()) {
      this.toastr.warning(`Please rent "${m.title}" to watch it.`, 'Rental Required');
      this.addToCart();
      return;
    }
    // incrementView is handled by the player component on load — not here
    this.router.navigate(['/watch', m.id]);
  }

  openRentModal(): void {
    this.showRentModal.set(true);
  }

  closeRentModal():  void { this.showRentModal.set(false); }
  closePaySuccess(): void { this.showPaySuccess.set(false); }

  confirmRent(): void {
    const userId  = this.auth.currentUser()?.userId;
    const movieId = this.movie()?.id;

    if (!userId || !movieId) {
      this.toastr.error('Session expired. Please log in again.', 'Error');
      return;
    }

    this.isRenting.set(true);

    this.http.post<any>(
      `${this.API}/Rental`,
      { userId, movieId, durationDays: this.selectedDuration() },
      { headers: this.authHeaders() }
    ).subscribe({
      next: () => {
        this.isRenting.set(false);
        this.paidAmount.set(this.totalCost());
        this.showRentModal.set(false);
        this.showPaySuccess.set(true);
        this.loadRentalState(movieId);
        this.cartService.loadCart(userId);
        this.rentalService.loadMyRentals(userId);
        this.wishlistService.loadWishlist(userId);
      },
      error: (err: any) => {
        this.isRenting.set(false);
        const msg =
          err.status === 401 ? 'Please log in to rent movies.' :
          err.status === 403 ? 'Access denied.' :
          err.status === 409 ? 'You already have an active rental for this movie.' :
          err.status === 400 ? (err?.error?.message ?? 'Invalid request.') :
          (err?.error?.message ?? 'Rental failed. Please try again.');
        this.toastr.error(msg, 'Rental Failed', { timeOut: 5000 });
      }
    });
  }

  addToCart(): void {
    const userId  = this.auth.currentUser()?.userId;
    const movieId = this.movie()?.id;
    if (!userId || !movieId) return;

    if (this.isInCart()) {
      this.router.navigate(['/cart']);
      return;
    }

    this.isAddingCart.set(true);
    this.cartService.addToCart({ userId, movieId, durationDays: 7 }).subscribe({
      next: () => {
        this.isAddingCart.set(false);
        this.cartService.loadCart(userId);
        this.toastr.success(`"${this.movie()?.title}" added to cart!`, 'Added to Cart');
        this.router.navigate(['/cart']);
      },
      error: (err: any) => {
        this.isAddingCart.set(false);
        if (err?.status === 409) {
          this.cartService.loadCart(userId);
          this.router.navigate(['/cart']);
        } else {
          this.toastr.error(err?.error?.message ?? 'Could not add to cart.', 'Error');
        }
      }
    });
  }

  toggleWishlist(): void {
    const userId  = this.auth.currentUser()?.userId;
    const movieId = this.movie()?.id;
    if (!userId || !movieId) return;

    this.isTogglingWish.set(true);

    if (this.isInWishlist()) {
      const item = this.wishlistService.getWishlistItem(movieId);
      if (!item) { this.isTogglingWish.set(false); return; }
      this.wishlistService.removeFromWishlist(item.id).subscribe({
        next: () => {
          this.wishlistService.loadWishlist(userId);
          this.isTogglingWish.set(false);
          this.toastr.info('Removed from wishlist.', 'Wishlist');
        },
        error: () => this.isTogglingWish.set(false)
      });
    } else {
      this.wishlistService.addToWishlist(userId, movieId).subscribe({
        next: () => {
          this.wishlistService.loadWishlist(userId);
          this.isTogglingWish.set(false);
          this.toastr.success('Added to wishlist.', 'Wishlist');
        },
        error: () => this.isTogglingWish.set(false)
      });
    }
  }

  onRated(value: number): void {
    this.userRating.set(value);
  }
}