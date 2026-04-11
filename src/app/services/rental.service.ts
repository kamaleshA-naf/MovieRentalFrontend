import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface RentalItem {
  id:            number;
  movieId:       number;
  movieTitle:    string;
  userId:        number;
  userName:      string;
  rentalDate:    string;
  expiryDate:    string;
  status:        string;
  rentalPrice?:  number;
  totalPaid?:    number;
  canReturn?:    boolean;
  refundAmount?: number;
}

export interface UserPayment {
  id:         number;
  rentalId:   number;
  movieId:    number;
  movieTitle: string;
  amount:     number;
  method:     string;
  status:     string;
  paidAt:     string;
}

interface PagedPayments {
  data:  UserPayment[];
  items: UserPayment[];
}

export interface RentRequest {
  userId:       number;
  movieId:      number;
  durationDays: number;
}

@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly API = environment.apiBase;
  private http = inject(HttpClient);

  myRentals      = signal<RentalItem[]>([]);
  myPayments     = signal<UserPayment[]>([]);
  isLoading      = signal(false);
  paymentsLoading = signal(false);

  loadMyRentals(userId: number): void {
    if (!userId) return;
    this.isLoading.set(true);

    // Load rentals
    this.http
      .get<RentalItem[]>(`${this.API}/Rental/user/${userId}`)
      .pipe(catchError(() => of([])))
      .subscribe((r: RentalItem[]) => {
        this.myRentals.set(r ?? []);
        this.isLoading.set(false);
      });

    // Load payments — response is PagedResultDto, unwrap .data
    this.paymentsLoading.set(true);
    this.http
      .get<PagedPayments>(`${this.API}/Payment/user/${userId}?pageSize=200`)
      .pipe(catchError((err) => {
        console.error('[RentalService] Failed to load payments:', err);
        return of({ data: [], items: [] } as PagedPayments);
      }))
      .subscribe((res: PagedPayments) => {
        const payments = res?.data ?? res?.items ?? [];
        console.log(`[RentalService] Loaded ${payments.length} payments for user ${userId}`);
        this.myPayments.set(payments);
        this.paymentsLoading.set(false);
      });
  }

  /** Actual amount charged for a rental (from Completed payment record) */
  getAmountPaidForRental(rentalId: number): number {
    const p = this.myPayments().find(
      x => x.rentalId === rentalId && x.status === 'Completed'
    );
    return p?.amount ?? 0;
  }

  /** Actual refund issued for a rental (from Refunded payment record) */
  getRefundedAmountForRental(rentalId: number): number {
    const p = this.myPayments().find(
      x => x.rentalId === rentalId && x.status === 'Refunded'
    );
    return p?.amount ?? 0;
  }

  rentMovie(req: RentRequest): Observable<any> {
    return this.http.post(`${this.API}/Rental`, req);
  }

  returnMovie(rentalId: number): Observable<any> {
    return this.http.put(`${this.API}/Rental/${rentalId}/return`, {});
  }

  hasActiveRental(movieId: number): boolean {
    return this.myRentals().some(
      r => r.movieId === movieId && r.status === 'Active'
    );
  }

  getRentalForMovie(movieId: number): RentalItem | undefined {
    return this.myRentals().find(r => r.movieId === movieId);
  }

  daysRemaining(expiryDate: string): number {
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }
}
