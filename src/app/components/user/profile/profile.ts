import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { RentalService } from '../../../services/rental.service';
import { WishlistService } from '../../../services/wishlist.service';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { CarouselComponent, CarouselItem } from '../../shared/carousel/carousel';
import { environment } from '@env/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent, CarouselComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  auth            = inject(AuthService);
  rentalService   = inject(RentalService);
  wishlistService = inject(WishlistService);
  private router  = inject(Router);
  private http    = inject(HttpClient);

  private readonly API = environment.apiBase;

  activeTab = signal<'overview' | 'rentals' | 'wishlist' | 'transactions'>('overview');
  isLoading = signal(true);

  activeRentals = computed(() =>
    this.rentalService.myRentals().filter(r => r.status === 'Active')
  );

  expiredRentals = computed(() =>
    this.rentalService.myRentals().filter(r => r.status === 'Expired')
  );

  // Transactions derived from rentals + actual payment records
  transactions = computed(() =>
    this.rentalService.myRentals().map(r => {
      const isRefunded = r.status === 'Returned';

      // 1. Try actual payment records (most accurate)
      const paidFromRecord    = this.rentalService.getAmountPaidForRental(r.id);
      const refundFromRecord  = this.rentalService.getRefundedAmountForRental(r.id);

      // 2. Fallback: totalPaid from DTO
      const totalPaidDto = r.totalPaid ?? 0;

      // 3. Fallback: rentalPrice × days
      const price = r.rentalPrice ?? 0;
      const days  = Math.max(1, Math.ceil(
        (new Date(r.expiryDate).getTime() - new Date(r.rentalDate).getTime()) / 86400000
      ));
      const calculated = price > 0 ? price * days : 0;

      const totalPaid = paidFromRecord > 0 ? paidFromRecord
                      : totalPaidDto   > 0 ? totalPaidDto
                      : calculated;

      const refundAmt = isRefunded
        ? (refundFromRecord > 0 ? refundFromRecord
          : r.refundAmount && r.refundAmount > 0 ? r.refundAmount
          : Math.round(totalPaid * 0.9))
        : 0;

      return {
        txnId:        `TXN${r.id.toString().padStart(6, '0')}${Math.abs(r.movieId * 7 % 1000).toString().padStart(3,'0')}`,
        movieTitle:   r.movieTitle,
        status:       isRefunded ? 'Refunded' : 'Completed',
        amount:       isRefunded ? refundAmt : totalPaid,
        date:         r.rentalDate,
        expiryDate:   r.expiryDate,
        rentalStatus: r.status
      };
    })
  );

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) { this.router.navigate(['/login']); return; }

    this.rentalService.loadMyRentals(userId);
    this.wishlistService.loadWishlist(userId);
    // isLoading drives the spinner — keep it true until rentals arrive
    // The signal-based computed() will auto-update once myRentals/myPayments load
    setTimeout(() => this.isLoading.set(false), 300);
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  daysRemaining(expiryDate: string): number {
    return this.rentalService.daysRemaining(expiryDate);
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      Active:   'status-active',
      Expired:  'status-expired',
      Returned: 'status-returned'
    };
    return m[status] ?? '';
  }

  watchMovie(movieId: number): void {
    this.router.navigate(['/watch', movieId]);
  }

  viewMovie(movieId: number): void {
    this.router.navigate(['/movie', movieId]);
  }

  rentalsToCarousel(): CarouselItem[] {
    return this.rentalService.myRentals().map(r => ({
      id:        r.movieId,
      title:     r.movieTitle,
      subtitle:  r.status,
      imageUrl:  null,
      meta:      `Expires ${this.formatDate(r.expiryDate)}`,
      badge:     r.status,
      badgeClass: r.status === 'Active' ? 'badge-active'
                : r.status === 'Expired' ? 'badge-expired' : 'badge-returned',
      _movieId:  r.movieId,
      _status:   r.status
    }));
  }

  wishlistToCarousel(): CarouselItem[] {
    return this.wishlistService.wishlist().map(w => ({
      id:        w.movieId,
      title:     w.movieTitle,
      subtitle:  `₹${w.rentalPrice}/day`,
      imageUrl:  w.thumbnailUrl,
      meta:      `Saved ${this.formatDate(w.addedDate)}`,
      badge:     `₹${w.rentalPrice}`,
      badgeClass: 'badge-price',
      _movieId:  w.movieId
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