import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface PaymentSummary {
  id:         number;
  userId:     number;
  userName:   string;
  movieId:    number;
  movieTitle: string;
  amount:     number;
  method:     string;
  status:     string;
  paidAt:     string;
}

export interface PaymentStats {
  totalRevenue:   number;
  totalPayments:  number;
  todayRevenue:   number;
  monthlyRevenue: number;
  successCount:   number;
  failedCount:    number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly API = 'https://localhost:7021/api';
  private http = inject(HttpClient);

  payments  = signal<PaymentSummary[]>([]);
  stats     = signal<PaymentStats | null>(null);
  isLoading = signal(false);

  loadAllPayments(): void {
    this.isLoading.set(true);
    // ✅ GET /api/Payment (Admin only)
    this.http
      .get<PaymentSummary[]>(`${this.API}/Payment`)
      .pipe(catchError(() => of([])))
      .subscribe(p => {
        this.payments.set(p ?? []);
        this.isLoading.set(false);
      });
  }

  loadStats(): void {
    // Use Admin/revenue for stats
    this.http
      .get<any>(`${this.API}/Admin/revenue`)
      .pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) {
          this.stats.set({
            totalRevenue:   s.totalRevenue   ?? 0,
            totalPayments:  s.totalPayments  ?? 0,
            todayRevenue:   s.todayRevenue   ?? 0,
            monthlyRevenue: s.monthlyRevenue ?? 0,
            successCount:   s.successCount   ?? 0,
            failedCount:    s.failedCount    ?? 0
          });
        }
      });
  }

  getAllPayments(): Observable<PaymentSummary[]> {
    return this.http
      .get<PaymentSummary[]>(`${this.API}/Payment`)
      .pipe(catchError(() => of([])));
  }
}