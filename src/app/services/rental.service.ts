import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface RentalItem {
  id:          number;
  movieId:     number;
  movieTitle:  string;
  userId:      number;
  userName:    string;
  rentalDate:  string;
  expiryDate:  string;
  status:      string;
  rentalPrice?: number;
}

export interface RentRequest {
  userId:       number;
  movieId:      number;
  durationDays: number;
}

@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly API = 'https://localhost:7021/api';
  private http = inject(HttpClient);

  myRentals = signal<RentalItem[]>([]);
  isLoading = signal(false);

  loadMyRentals(userId: number): void {
    if (!userId) return;
    this.isLoading.set(true);
    this.http
      .get<RentalItem[]>(`${this.API}/Rental/user/${userId}`)
      .pipe(catchError(() => of([])))
      .subscribe((r: RentalItem[]) => {
        this.myRentals.set(r ?? []);
        this.isLoading.set(false);
      });
  }

  rentMovie(req: RentRequest): Observable<any> {
    return this.http.post(`${this.API}/Rental`, req);
  }

  returnMovie(rentalId: number): Observable<any> {
    return this.http.put(
      `${this.API}/Rental/${rentalId}/return`, {}
    );
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