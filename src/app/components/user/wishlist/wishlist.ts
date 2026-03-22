import {
  Component, inject, signal, computed, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../services/auth.service';
import { WishlistService, WishlistItem } from '../../../services/wishlist.service';
import { NavbarComponent } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class WishlistComponent implements OnInit {
  auth            = inject(AuthService);
  wishlistService = inject(WishlistService);
  router          = inject(Router);
  private toastr  = inject(ToastrService);

  removingId = signal<number | null>(null);
  isLoading  = signal(true);

  readonly PLACEHOLDER =
    'assets/images/placeholders/movie-placeholder.svg';

  totalCost = computed(() =>
    this.wishlistService.wishlist()
      .reduce((sum, item) => sum + item.rentalPrice, 0)
  );

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.wishlistService.loadWishlist(userId);
    this.isLoading.set(false);
  }

  viewMovie(movieId: number): void {
    this.router.navigate(['/movie', movieId]);
  }

  remove(item: WishlistItem): void {
    if (this.removingId() === item.id) return;
    this.removingId.set(item.id);

    this.wishlistService.removeFromWishlist(item.id).subscribe({
      next: () => {
        const userId = this.auth.currentUser()?.userId ?? 0;
        this.wishlistService.loadWishlist(userId);
        this.toastr.info(
          `"${item.movieTitle}" removed.`, 'Wishlist'
        );
        this.removingId.set(null);
      },
      error: (err: any) => {
        this.toastr.error(
          err?.error?.message ?? 'Failed to remove.', 'Error'
        );
        this.removingId.set(null);
      }
    });
  }

  rentAll(): void {
    const first = this.wishlistService.wishlist()[0];
    if (first) this.router.navigate(['/movie', first.movieId]);
  }

  posterUrl(url: string | null): string {
    return url ?? this.PLACEHOLDER;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}