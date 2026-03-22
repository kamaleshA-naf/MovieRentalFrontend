import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { UserResponse } from '../models/user.model';

export interface AdminPaymentItem {
  id:         number;
  userId:     number;
  userName:   string;
  movieId:    number;
  movieTitle: string;
  rentalId:   number;
  amount:     number;
  method:     string;
  status:     string;
  paidAt:     string;
}

export interface AdminPaymentSummary {
  totalRevenue:  number;
  totalPayments: number;
  payments:      AdminPaymentItem[];
}

export interface AdminDashboardStats {
  totalUsers:    number;
  totalMovies:   number;
  totalRentals:  number;
  activeRentals: number;
  totalRevenue:  number;
  totalPayments: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = 'https://localhost:7021/api';
  private http = inject(HttpClient);

  getDashboardStats(): Observable<AdminDashboardStats> {
    return this.http
      .get<AdminDashboardStats>(`${this.API}/Admin/dashboard`)
      .pipe(catchError(() => of({
        totalUsers: 0, totalMovies: 0, totalRentals: 0,
        activeRentals: 0, totalRevenue: 0, totalPayments: 0
      })));
  }

  getAllUsers(): Observable<UserResponse[]> {
    return this.http
      .get<UserResponse[]>(`${this.API}/User`)
      .pipe(catchError(() => of([])));
  }

  getAllUsersWithRentals(): Observable<any[]> {
    return this.http
      .get<any>(`${this.API}/Admin/users/rentals`)
      .pipe(
        map(res => Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])),
        catchError(() => of([]))
      );
  }

  /**
   * Handles both response shapes:
   * Shape A (flat array): [{ id, amount, ... }, ...]
   * Shape B (wrapped):    { totalRevenue, totalPayments, payments: [...] }
   */
  getAllPaymentsSummary(): Observable<AdminPaymentSummary> {
    return this.http
      .get<any>(`${this.API}/Admin/payments`)
      .pipe(
        map(res => {
          // Shape B — already has payments array
          if (res && Array.isArray(res.payments)) {
            return res as AdminPaymentSummary;
          }
          // Shape A — flat array of payments
          if (Array.isArray(res)) {
            const total = res.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
            return {
              totalRevenue:  total,
              totalPayments: res.length,
              payments:      res
            };
          }
          // Shape C — wrapped in items
          if (res?.items && Array.isArray(res.items)) {
            const total = res.items.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
            return {
              totalRevenue:  total,
              totalPayments: res.items.length,
              payments:      res.items
            };
          }
          return { totalRevenue: 0, totalPayments: 0, payments: [] };
        }),
        catchError(() => of({ totalRevenue: 0, totalPayments: 0, payments: [] }))
      );
  }

  getRevenueSummary(): Observable<any> {
    return this.http
      .get<any>(`${this.API}/Admin/revenue`)
      .pipe(catchError(() => of(null)));
  }

  getAllLogs(): Observable<any[]> {
    return this.http
      .get<any>(`${this.API}/Admin/logs`)
      .pipe(
        map(res => Array.isArray(res) ? res : (res?.items ?? [])),
        catchError(() => of([]))
      );
  }

  getAllRatings(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.API}/Movie/ratings/all`)
      .pipe(catchError(() => of([])));
  }

  deleteUser(userId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.API}/User/${userId}`)
      .pipe(catchError(err => { throw err; }));
  }
}