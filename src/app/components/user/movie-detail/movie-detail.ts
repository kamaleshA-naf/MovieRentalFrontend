import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule }     from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { MovieRatingComponent }
  from '../../shared/movie-rating/movie-rating';
import { MovieService }    from '../../../services/movie.service';
import { RentalService }   from '../../../services/rental.service';
import { WishlistService } from '../../../services/wishlist.service';
import { CartService }     from '../../../services/cart.service';
import { AuthService }     from '../../../services/auth.service';
import { ToastrService }   from 'ngx-toastr';
import { MovieResponse }   from '../../../models/movie.model';

@Component({
  selector:    'app-movie-detail',
  standalone:  true,
  imports: [
    CommonModule, FormsModule,
    NavbarComponent, MovieRatingComponent
  ],
  templateUrl: './movie-detail.html',
  styleUrl:    './movie-detail.css'
})
export class MovieDetailComponent implements OnInit {
  router         = inject(Router);
  private route  = inject(ActivatedRoute);
  movieSvc       = inject(MovieService);
  rentalService  = inject(RentalService);
  wishlistSvc    = inject(WishlistService);
  cartService    = inject(CartService);
  auth           = inject(AuthService);
  private toastr = inject(ToastrService);

  movie     = signal<MovieResponse | null>(null);
  isLoading = signal(true);
  notFound  = signal(false);

  showRentModal    = signal(false);
  selectedDuration = signal(7);
  isRenting        = signal(false);
  showPaySuccess   = signal(false);
  paidAmount       = signal(0);
  isAddingCart     = signal(false);

  isInWishlist   = signal(false);
  wishlistItemId = signal<number | null>(null);
  isTogglingWish = signal(false);
  userRating     = signal(0);

  readonly durations   = [1, 3, 7, 14, 30];
  readonly PLACEHOLDER =
    'assets/images/placeholders/movie-placeholder.svg';

  hasAccess = computed(() => {
    const m = this.movie();
    if (!m) return false;
    return this.rentalService.hasActiveRental(m.id);
  });

  isExpired = computed(() => {
    const m = this.movie();
    if (!m) return false;
    const r = this.rentalService.getRentalForMovie(m.id);
    return !!r && r.status === 'Expired';
  });

  activeRental = computed(() => {
    const m = this.movie();
    if (!m) return null;
    return this.rentalService.getRentalForMovie(m.id) ?? null;
  });

  daysLeft = computed(() => {
    const r = this.activeRental();
    if (!r || r.status !== 'Active') return 0;
    return this.rentalService.daysRemaining(r.expiryDate);
  });

  totalCost = computed(() =>
    (this.movie()?.rentalPrice ?? 0) * this.selectedDuration()
  );

  // ✅ Reads from cartService signal — live, reactive
  isInCart = computed(() => {
    const m = this.movie();
    if (!m) return false;
    return this.cartService.isInCart(m.id);
  });

  ngOnInit(): void {
    const id     = Number(this.route.snapshot.paramMap.get('id'));
    const userId = this.auth.currentUser()?.userId ?? 0;

    if (userId > 0) {
      this.rentalService.loadMyRentals(userId);
      this.wishlistSvc.loadWishlist(userId);
      this.cartService.loadCart(userId);
    }

    this.movieSvc.getMovieById(id).subscribe({
      next: (m) => {
        this.movie.set(m);
        this.isLoading.set(false);
        this.syncWishlistState(m.id);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
        this.toastr.error('Movie not found.', 'Error');
        setTimeout(() => this.router.navigate(['/home']), 2000);
      }
    });
  }

  private syncWishlistState(movieId: number): void {
    const found = this.wishlistSvc.getWishlistItem(movieId);
    this.isInWishlist.set(!!found);
    this.wishlistItemId.set(found?.id ?? null);
  }

  toggleWishlist(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    const movie  = this.movie();
    if (!userId || !movie || this.isTogglingWish()) return;
    this.isTogglingWish.set(true);

    if (this.isInWishlist()) {
      const wId = this.wishlistItemId();
      if (!wId) { this.isTogglingWish.set(false); return; }
      this.wishlistSvc.removeFromWishlist(wId).subscribe({
        next: () => {
          this.wishlistSvc.loadWishlist(userId);
          this.isInWishlist.set(false);
          this.wishlistItemId.set(null);
          this.isTogglingWish.set(false);
          this.toastr.info('Removed from wishlist.', 'Wishlist');
        },
        error: () => this.isTogglingWish.set(false)
      });
    } else {
      this.wishlistSvc.addToWishlist(userId, movie.id).subscribe({
        next: (res: any) => {
          this.wishlistSvc.loadWishlist(userId);
          this.isInWishlist.set(true);
          this.wishlistItemId.set(res?.id ?? null);
          this.isTogglingWish.set(false);
          this.toastr.success('Added to wishlist!', 'Wishlist');
        },
        error: (err: any) => {
          this.isTogglingWish.set(false);
          this.toastr.warning(
            err?.error?.message ?? 'Already in wishlist.', 'Notice'
          );
        }
      });
    }
  }

  // ✅ Add to Cart — full duplicate prevention
  addToCart(): void {
    const movie  = this.movie();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!movie || !userId || this.isAddingCart()) return;

    if (this.cartService.isInCart(movie.id)) {
      this.toastr.warning(
        `"${movie.title}" is already in your cart.`,
        'Already in Cart'
      );
      return;
    }

    this.isAddingCart.set(true);
    this.cartService.addToCart({
      userId, movieId: movie.id, durationDays: 7
    }).subscribe({
      next: () => {
        this.cartService.loadCart(userId);
        this.isAddingCart.set(false);
        this.toastr.success(
          `"${movie.title}" added to cart!`, 'Added to Cart 🛒'
        );
      },
      error: (err: any) => {
        this.isAddingCart.set(false);
        if (err?.status === 409) {
          this.toastr.warning(
            `"${movie.title}" is already in your cart.`,
            'Already in Cart'
          );
          this.cartService.loadCart(userId);
        } else {
          this.toastr.error(
            err?.error?.message ?? 'Could not add to cart.', 'Error'
          );
        }
      }
    });
  }

  openRentModal(): void  { this.showRentModal.set(true); }
  closeRentModal(): void { this.showRentModal.set(false); }

  confirmRent(): void {
    const movie  = this.movie();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!movie || !userId || this.isRenting()) return;

    this.isRenting.set(true);
    this.rentalService.rentMovie({
      userId, movieId: movie.id,
      durationDays: this.selectedDuration()
    }).subscribe({
      next: () => {
        this.isRenting.set(false);
        this.showRentModal.set(false);
        this.paidAmount.set(movie.rentalPrice * this.selectedDuration());
        this.showPaySuccess.set(true);
        this.rentalService.loadMyRentals(userId);
        this.toastr.success('Rental successful!', 'MovieBox');
      },
      error: (err: any) => {
        this.isRenting.set(false);
        this.toastr.error(
          err?.error?.message ?? 'Rental failed.', 'Error'
        );
      }
    });
  }

  closePaySuccess(): void { this.showPaySuccess.set(false); }

  watchNow(): void {
    const movie = this.movie();
    if (!movie) return;
    if (!this.hasAccess()) {
      this.toastr.warning('Please rent this movie first.', 'Access Required');
      return;
    }
    this.router.navigate(['/player', movie.id]);
  }

  onRated(value: number): void { this.userRating.set(value); }

  poster(url: string | null | undefined): string {
    return url ?? this.PLACEHOLDER;
  }
}