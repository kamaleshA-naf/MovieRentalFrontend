import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { UserResponse } from '../models/user.model';
import { environment } from '@env/environment';

export interface AdminPaymentItem {
  id: number; userId: number; userName: string;
  movieId: number; movieTitle: string; rentalId: number;
  amount: number; method: string; status: string; paidAt: string;
  refundedAmount?: number;
}

export interface AdminPaymentSummary {
  totalRevenue: number; totalPayments: number; payments: AdminPaymentItem[];
}

export interface AdminDashboardStats {
  totalUsers: number; totalMovies: number; totalRentals: number;
  activeRentals: number; totalRevenue: number; totalPayments: number;
}

export interface MovieRatingSummary {
  movieId: number; movieTitle: string;
  averageRating: number; totalRatings: number;
  notForMeCount: number; likeCount: number; loveCount: number;
}

export interface RatingRow {
  movieId: number; movieTitle: string;
  totalRatings: number; loveCount: number;
  likeCount: number; notForMeCount: number; averageRating: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = environment.apiBase;
  private http = inject(HttpClient);

  getDashboardStats(): Observable<AdminDashboardStats> {
    return this.http.get<AdminDashboardStats>(`${this.API}/Admin/dashboard`)
      .pipe(catchError(() => of({
        totalUsers:0, totalMovies:0, totalRentals:0,
        activeRentals:0, totalRevenue:0, totalPayments:0
      })));
  }

  getAllUsers(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(`${this.API}/User`)
      .pipe(catchError(() => of([])));
  }

  getAllUsersWithRentals(): Observable<any[]> {
    return this.http.get<any>(`${this.API}/Admin/users/rentals`).pipe(
      map(res => Array.isArray(res) ? res : (res?.items ?? res?.data ?? [])),
      catchError(() => of([]))
    );
  }

  getAllPaymentsSummary(): Observable<AdminPaymentSummary> {
    // Pass page/pageSize so backends that require them return data
    return this.http.get<any>(`${this.API}/Admin/payments?page=1&pageSize=50`).pipe(
      map(res => {
        // Shape: { items: [...], totalCount }
        if (res && Array.isArray(res.items)) {
          const payments = res.items as AdminPaymentItem[];
          return {
            totalRevenue:  payments.filter(p => p.status === 'Completed').reduce((s, p) => s + (p.amount ?? 0), 0),
            totalPayments: res.totalCount ?? payments.length,
            payments
          };
        }
        // Shape: { payments: [...] }
        if (res && Array.isArray(res.payments)) return res as AdminPaymentSummary;
        // Shape: plain array
        if (Array.isArray(res)) return {
          totalRevenue: res.reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
          totalPayments: res.length, payments: res
        };
        // Shape: { data: [...] }
        if (res?.data) return {
          totalRevenue: res.data.reduce((s: number, p: any) => s + (p.amount ?? 0), 0),
          totalPayments: res.totalCount ?? res.data.length, payments: res.data
        };
        return { totalRevenue: 0, totalPayments: 0, payments: [] };
      }),
      catchError(() => of({ totalRevenue: 0, totalPayments: 0, payments: [] }))
    );
  }

  
  getAllRatings(): Observable<RatingRow[]> {
    return this.http.get<any>(`${this.API}/Movie?pageNumber=1&pageSize=200`).pipe(
      map(res => Array.isArray(res) ? res : (res?.items ?? res?.data ?? res?.movies ?? [])),
      switchMap((movies: any[]) => {
        if (!movies.length) return of([]);
        const requests: Observable<MovieRatingSummary>[] = movies.map((m: any) =>
          this.http.get<MovieRatingSummary>(`${this.API}/Movie/${m.id}/ratings`)
            .pipe(catchError(() => of({
              movieId: m.id, movieTitle: m.title ?? '',
              averageRating:0, totalRatings:0,
              notForMeCount:0, likeCount:0, loveCount:0
            })))
        );
        return forkJoin(requests);
      }),
      map((summaries: MovieRatingSummary[]) =>
        summaries
          .filter(s => s.totalRatings > 0)
          .sort((a, b) => b.totalRatings - a.totalRatings)
          .map(s => ({
            movieId:       s.movieId,
            movieTitle:    s.movieTitle,
            totalRatings:  s.totalRatings,
            loveCount:     s.loveCount,
            likeCount:     s.likeCount,
            notForMeCount: s.notForMeCount,
            averageRating: s.averageRating
          }))
      ),
      catchError(() => of([]))
    );
  }

  /**
   * Confirmed from backend source:
   * GET /api/Admin/logs  →  works, returns audit log list
   */
  getAllLogs(): Observable<any[]> {
    return this.http.get<any>(`${this.API}/Admin/logs`).pipe(
      map(res => {
        const arr: any[] = Array.isArray(res) ? res
          : (res?.items ?? res?.data ?? res?.logs ?? []);
        return arr.sort((a:any, b:any) =>
          new Date(b.createdAt ?? b.timestamp ?? 0).getTime() -
          new Date(a.createdAt ?? a.timestamp ?? 0).getTime()
        );
      }),
      catchError(() => of([]))
    );
  }

  // getTodayUsers(): Observable<any[]> {
  //   // Try dedicated today endpoint first, fall back to filter param
  //   return this.http.get<any>(`${this.API}/Admin/users/today`).pipe(
  //     map(res => {
  //       const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  //       return arr.map((u: any) => ({
  //         ...u,
  //         userName: u.userName ?? u.name ?? '',
  //         email:    u.userEmail ?? u.email ?? '',
  //         userId:   u.userId ?? u.id,
  //       }));
  //     }),
  //     catchError(() =>
  //       // Fallback: use filter=today query param
  //       this.http.get<any>(`${this.API}/Admin/users?filter=today`).pipe(
  //         map(res => {
  //           const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
  //           return arr.map((u: any) => ({
  //             ...u,
  //             userName: u.userName ?? u.name ?? '',
  //             email:    u.userEmail ?? u.email ?? '',
  //             userId:   u.userId ?? u.id,
  //           }));
  //         }),
  //         catchError(() => of([]))
  //       )
  //     )
  //   );
  // }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/User/${userId}`)
      .pipe(catchError(err => { throw err; }));
  }
}