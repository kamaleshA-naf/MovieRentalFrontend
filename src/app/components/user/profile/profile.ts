import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { RentalService } from '../../../services/rental.service';
import { WishlistService } from '../../../services/wishlist.service';
import { NavbarComponent } from '../../shared/navbar/navbar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  auth            = inject(AuthService);
  rentalService   = inject(RentalService);
  wishlistService = inject(WishlistService);
  private router  = inject(Router);
  private http    = inject(HttpClient);

  private readonly API = 'https://localhost:7021/api';

  activeTab = signal<'overview' | 'rentals' | 'wishlist'>('overview');
  isLoading = signal(true);

  activeRentals = computed(() =>
    this.rentalService.myRentals().filter(r => r.status === 'Active')
  );

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) { this.router.navigate(['/login']); return; }

    this.rentalService.loadMyRentals(userId);
    this.wishlistService.loadWishlist(userId);
    this.isLoading.set(false);
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
}