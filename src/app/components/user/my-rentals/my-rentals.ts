import {
  Component, inject, signal, computed, OnInit
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { Router }          from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar';
import {RentalService, RentalItem
} from '../../../services/rental.service';
import { AuthService }     from '../../../services/auth.service';
import { ToastrService }   from 'ngx-toastr';

type FilterTab = 'all' | 'Active' | 'Expired' | 'Returned';

@Component({
  selector:    'app-my-rentals',
  standalone:  true,
  imports:     [CommonModule, NavbarComponent],
  templateUrl: './my-rentals.html',
  styleUrl:    './my-rentals.css'
})
export class MyRentalsComponent implements OnInit {
  // ✅ public — used in template
  rentalService = inject(RentalService);
  router        = inject(Router);

  private auth   = inject(AuthService);
  private toastr = inject(ToastrService);

  returningId  = signal<number | null>(null);
  activeFilter = signal<FilterTab>('all');

  readonly PLACEHOLDER =
    'assets/images/placeholders/movie-placeholder.svg';

  filtered = computed(() => {
    const f   = this.activeFilter();
    const all = this.rentalService.myRentals();
    if (f === 'all') return all;
    return all.filter((r: RentalItem) => r.status === f);
  });

  activeCount = computed(() =>
    this.rentalService.myRentals()
      .filter((r: RentalItem) => r.status === 'Active').length
  );

  expiredCount = computed(() =>
    this.rentalService.myRentals()
      .filter((r: RentalItem) => r.status === 'Expired').length
  );

  returnedCount = computed(() =>
    this.rentalService.myRentals()
      .filter((r: RentalItem) => r.status === 'Returned').length
  );

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.rentalService.loadMyRentals(userId);
  }

  returnMovie(rental: RentalItem): void {
    if (!confirm(
      `Return "${rental.movieTitle}"? You will lose access.`
    )) return;

    this.returningId.set(rental.id);
    this.rentalService.returnMovie(rental.id).subscribe({
      next: () => {
        this.toastr.success(
          `"${rental.movieTitle}" returned.`, 'Returned'
        );
        this.returningId.set(null);
        const userId = this.auth.currentUser()?.userId ?? 0;
        this.rentalService.loadMyRentals(userId);
      },
      error: (err: any) => {
        this.toastr.error(
          err?.error?.message ?? 'Return failed.', 'Error'
        );
        this.returningId.set(null);
      }
    });
  }

  watchMovie(rental: RentalItem): void {
    if (rental.status !== 'Active') {
      this.toastr.warning('Rental has expired.', 'No Access');
      return;
    }
    this.router.navigate(['/player', rental.movieId]);
  }

  goToMovie(rental: RentalItem): void {
    this.router.navigate(['/movie', rental.movieId]);
  }

  daysLeft(expiryDate: string): number {
    return this.rentalService.daysRemaining(expiryDate);
  }

  progressWidth(rental: RentalItem): number {
    const start     = new Date(rental.rentalDate).getTime();
    const end       = new Date(rental.expiryDate).getTime();
    const total     = end - start;
    const remaining = end - Date.now();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  statusClass(status: string): string {
    if (status === 'Active')   return 'pill-active';
    if (status === 'Expired')  return 'pill-expired';
    if (status === 'Returned') return 'pill-returned';
    return '';
  }

  poster(url?: string | null): string {
    return url ?? this.PLACEHOLDER;
  }
}