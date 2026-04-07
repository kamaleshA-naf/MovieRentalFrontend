import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface PaymentSummary {
  id:              number;
  userId:          number;
  userName:        string;
  movieId:         number;
  movieTitle:      string;
  amount:          number;
  method:          string;
  status:          string;
  paidAt:          string;
  refundedAmount?: number;
}

export interface PagedPayments {
  items:      PaymentSummary[];
  totalCount: number;
  pageNumber: number;
  pageSize:   number;
  totalPages: number;
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
  private readonly API = environment.apiBase;
  private http = inject(HttpClient);

  payments    = signal<PaymentSummary[]>([]);
  totalCount  = signal(0);
  totalPages  = signal(1);
  currentPage = signal(1);
  pageSize    = signal(10);
  stats       = signal<PaymentStats | null>(null);
  isLoading   = signal(false);

  /** Primary loader — calls the correct paginated Admin endpoint */
  loadPayments(page = 1, size = 10): void {
    this.isLoading.set(true);
    this.currentPage.set(page);
    this.pageSize.set(size);

    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', size);

    this.http
      .get<any>(`${this.API}/Admin/payments`, { params })
      .pipe(
        map(res => this.normaliseResponse(res)),
        catchError(() => of({ items: [], totalCount: 0, totalPages: 1 }))
      )
      .subscribe(data => {
        this.payments.set(data.items);
        this.totalCount.set(data.totalCount);
        this.totalPages.set(data.totalPages || Math.max(1, Math.ceil(data.totalCount / size)));
        this.isLoading.set(false);
      });
  }

  /** Kept for backward-compat — delegates to loadPayments */
  loadAllPayments(): void {
    this.loadPayments(1, this.pageSize());
  }

  loadStats(): void {
    this.http
      .get<any>(`${this.API}/Admin/revenue`)
      .pipe(catchError(() => of(null)))
      .subscribe(s => {
        if (s) {
          this.stats.set({
            totalRevenue:   s.totalRevenue   ?? s.completedRevenue ?? 0,
            totalPayments:  s.totalPayments  ?? 0,
            todayRevenue:   s.todayRevenue   ?? 0,
            monthlyRevenue: s.monthlyRevenue ?? 0,
            successCount:   s.successCount   ?? s.completedPayments ?? 0,
            failedCount:    s.failedCount    ?? s.failedPayments    ?? 0
          });
        }
      });
  }

  getAllPayments(): Observable<PaymentSummary[]> {
    return this.http
      .get<any>(`${this.API}/Admin/payments?page=1&pageSize=1000`)
      .pipe(
        map(res => this.normaliseResponse(res).items),
        catchError(() => of([]))
      );
  }

  /** Safely extract items + totalCount from any response shape */
  private normaliseResponse(res: any): { items: PaymentSummary[]; totalCount: number; totalPages: number } {
    // Shape 1: { items: [...], totalCount, totalPages }
    if (res && Array.isArray(res.items)) {
      return { items: res.items, totalCount: res.totalCount ?? res.items.length, totalPages: res.totalPages ?? 1 };
    }
    // Shape 2: { payments: [...], totalRevenue, totalPayments }
    if (res && Array.isArray(res.payments)) {
      return { items: res.payments, totalCount: res.totalPayments ?? res.payments.length, totalPages: 1 };
    }
    // Shape 3: { data: [...] }
    if (res && Array.isArray(res.data)) {
      return { items: res.data, totalCount: res.totalCount ?? res.data.length, totalPages: res.totalPages ?? 1 };
    }
    // Shape 4: plain array
    if (Array.isArray(res)) {
      return { items: res, totalCount: res.length, totalPages: 1 };
    }
    return { items: [], totalCount: 0, totalPages: 1 };
  }
}
