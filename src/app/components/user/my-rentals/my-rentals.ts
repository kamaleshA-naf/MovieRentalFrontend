import {
  Component, inject, signal, computed, OnInit, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { Router }          from '@angular/router';
import { HttpClient }      from '@angular/common/http';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { CarouselComponent, CarouselItem } from '../../shared/carousel/carousel';
import { RentalService, RentalItem } from '../../../services/rental.service';
import { AuthService }     from '../../../services/auth.service';
import { ToastrService }   from 'ngx-toastr';
import { catchError, of }  from 'rxjs';
import { environment } from '@env/environment';

type FilterTab = 'all' | 'Active' | 'Expired' | 'Returned';

@Component({
  selector:    'app-my-rentals',
  standalone:  true,
  imports:     [CommonModule, NavbarComponent, CarouselComponent],
  templateUrl: './my-rentals.html',
  styleUrl:    './my-rentals.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyRentalsComponent implements OnInit {
  rentalService = inject(RentalService);
  router        = inject(Router);
  private auth   = inject(AuthService);
  private toastr = inject(ToastrService);
  private http   = inject(HttpClient);

  private readonly API = environment.apiBase;

  returningId     = signal<number | null>(null);
  renewingId      = signal<number | null>(null);
  activeFilter    = signal<FilterTab>('all');
  deletedMovieIds = signal<Set<number>>(new Set());

  // Refund modal state
  refundRental    = signal<RentalItem | null>(null);
  refundTxnId     = signal('');
  refundSuccess   = signal(false);

  readonly PLACEHOLDER = 'assets/images/placeholders/movie-placeholder.svg';

  filtered = computed(() => {
    const f   = this.activeFilter();
    const all = this.rentalService.myRentals();
    if (f === 'all') return all;
    return all.filter((r: RentalItem) => r.status === f);
  });

  activeCount = computed(() =>
    this.rentalService.myRentals().filter((r: RentalItem) => r.status === 'Active').length
  );

  expiredCount = computed(() =>
    this.rentalService.myRentals().filter((r: RentalItem) => r.status === 'Expired').length
  );

  returnedCount = computed(() =>
    this.rentalService.myRentals().filter((r: RentalItem) => r.status === 'Returned').length
  );

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId) { this.router.navigate(['/login']); return; }
    this.rentalService.loadMyRentals(userId);
    // Wait for rentals to load before checking deleted movies
    setTimeout(() => this.checkDeletedMovies(), 1200);
  }

  private checkDeletedMovies(): void {
    const rentals = this.rentalService.myRentals();
    const uniqueMovieIds = [...new Set(rentals.map(r => r.movieId))];
    uniqueMovieIds.forEach(movieId => {
      this.http.get(`${this.API}/Movie/${movieId}`)
        .pipe(catchError(err => {
          if (err?.status === 404) {
            this.deletedMovieIds.update(s => new Set([...s, movieId]));
          }
          return of(null);
        }))
        .subscribe();
    });
  }

  isMovieDeleted(movieId: number): boolean {
    return this.deletedMovieIds().has(movieId);
  }

  // Renew: frontend-only optimistic update + API reload
  renewRental(rental: RentalItem): void {
    if (this.renewingId() === rental.id) return;
    this.renewingId.set(rental.id);

    const base = new Date(Math.max(Date.now(), new Date(rental.expiryDate).getTime()));
    base.setDate(base.getDate() + 3);

    // Optimistic update
    this.rentalService.myRentals.update(list =>
      list.map(r => r.id === rental.id
        ? { ...r, expiryDate: base.toISOString(), status: 'Active' }
        : r
      )
    );

    setTimeout(() => {
      this.renewingId.set(null);
      this.toastr.success(`"${rental.movieTitle}" renewed for 3 days.`, 'Renewed ✓');
      // Reload from API to get authoritative state
      const userId = this.auth.currentUser()?.userId ?? 0;
      if (userId) this.rentalService.loadMyRentals(userId);
    }, 400);
  }

  returnMovie(rental: RentalItem): void {
    // Show refund popup instead of direct return
    this.refundSuccess.set(false);
    this.refundRental.set(rental);
    this.refundTxnId.set('');
  }

  amountPaid(rental: RentalItem): number {
    // 1. Try actual payment record (most accurate — real amount charged)
    const fromPayment = this.rentalService.getAmountPaidForRental(rental.id);
    if (fromPayment > 0) return fromPayment;

    // 2. Use backend-provided totalPaid
    if (rental.totalPaid && rental.totalPaid > 0) return rental.totalPaid;

    // 3. Calculate from rentalPrice × days
    const price = rental.rentalPrice ?? 0;
    if (price > 0) {
      const days = Math.max(1, Math.ceil(
        (new Date(rental.expiryDate).getTime() - new Date(rental.rentalDate).getTime()) / 86400000
      ));
      return price * days;
    }

    return 0;
  }

  refundPercent(rental: RentalItem): number {
    const hoursElapsed = (Date.now() - new Date(rental.rentalDate).getTime()) / 3600000;
    return hoursElapsed <= 24 ? 90 : 0;
  }

  refundAmount(rental: RentalItem): number {
    // 1. Use actual refund payment record
    const fromPayment = this.rentalService.getRefundedAmountForRental(rental.id);
    if (fromPayment > 0) return fromPayment;

    // 2. Use backend-provided refundAmount
    if (rental.refundAmount && rental.refundAmount > 0) return rental.refundAmount;

    // 3. Calculate live
    const paid = this.amountPaid(rental);
    return Math.round(paid * this.refundPercent(rental) / 100);
  }

  // Return button only visible within 1 day of rental
  canReturn(rental: RentalItem): boolean {
    const hoursElapsed = (Date.now() - new Date(rental.rentalDate).getTime()) / 3600000;
    return hoursElapsed <= 24;
  }

  private generateTxnId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'TXN';
    for (let i = 0; i < 9; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  confirmReturn(): void {
    const rental = this.refundRental();
    if (!rental) return;
    this.returningId.set(rental.id);
    this.rentalService.returnMovie(rental.id).subscribe({
      next: () => {
        const txn = this.generateTxnId();
        this.refundTxnId.set(txn);
        this.refundSuccess.set(true);
        this.returningId.set(null);
        // Immediately update local state so progress bar disappears
        this.rentalService.myRentals.update(list =>
          list.map(r => r.id === rental.id
            ? { ...r, status: 'Returned' }
            : r
          )
        );
        const userId = this.auth.currentUser()?.userId ?? 0;
        this.rentalService.loadMyRentals(userId);
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message ?? 'Return failed.', 'Error');
        this.returningId.set(null);
        this.refundRental.set(null);
      }
    });
  }

  closeRefundModal(): void {
    this.refundRental.set(null);
    this.refundSuccess.set(false);
    this.refundTxnId.set('');
  }

  watchMovie(rental: RentalItem): void {
    if (rental.status !== 'Active') {
      this.toastr.warning('This rental has expired.', 'Expired');
      return;
    }
    this.router.navigate(['/watch', rental.movieId]);
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
    return Math.round(Math.max(0, Math.min(100, (remaining / total) * 100)));
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

  poster(url?: string | null): string { return url ?? this.PLACEHOLDER; }

  toCarouselItems(rentals: RentalItem[]): CarouselItem[] {
    return rentals.map(r => ({
      id:        r.movieId,
      title:     r.movieTitle,
      subtitle:  r.status,
      imageUrl:  null,
      meta:      `Expires ${this.formatDate(r.expiryDate)}`,
      badge:     r.status,
      badgeClass: r.status === 'Active' ? 'badge-active'
                : r.status === 'Expired' ? 'badge-expired' : 'badge-returned',
      _rental:   r
    }));
  }

  onCarouselClick(item: CarouselItem): void {
    const rental = item['_rental'] as RentalItem;
    if (rental?.status === 'Active') this.watchMovie(rental);
    else this.goToMovie(rental);
  }
}
