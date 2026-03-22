import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface CartItem {
  id:           number;
  userId:       number;
  movieId:      number;
  movieTitle:   string;
  thumbnailUrl: string | null;
  rentalPrice:  number;
  durationDays: number;
  totalCost:    number;
  addedAt:      string;
  genres:       { id: number; name: string }[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly API  = 'https://localhost:7021/api';
  private readonly BASE = 'https://localhost:7021';
  private http = inject(HttpClient);

  cartItems  = signal<CartItem[]>([]);
  cartCount  = signal(0);

  private fixThumb(item: CartItem): CartItem {
    return {
      ...item,
      thumbnailUrl: item.thumbnailUrl
        ? (item.thumbnailUrl.startsWith('http')
            ? item.thumbnailUrl
            : this.BASE + item.thumbnailUrl)
        : null
    };
  }

  loadCart(userId: number): void {
    this.http
      .get<CartItem[]>(`${this.API}/Cart/user/${userId}`)
      .pipe(catchError(() => of([])))
      .subscribe(items => {
        const arr = Array.isArray(items) ? items : [];
        const fixed = arr.map(i => this.fixThumb(i));
        this.cartItems.set(fixed);
        this.cartCount.set(fixed.length);
      });
  }

  isInCart(movieId: number): boolean {
    return this.cartItems().some(i => i.movieId === movieId);
  }

  addToCart(dto: {
    userId: number;
    movieId: number;
    durationDays: number;
  }): Observable<any> {
    return this.http
      .post<any>(`${this.API}/Cart`, dto)
      .pipe(catchError(err => { throw err; }));
  }

  removeFromCart(cartItemId: number): Observable<any> {
    return this.http
      .delete<any>(`${this.API}/Cart/${cartItemId}`)
      .pipe(catchError(err => { throw err; }));
  }

  updateDuration(cartItemId: number, durationDays: number): Observable<any> {
    return this.http
      .put<any>(`${this.API}/Cart/${cartItemId}/duration`, { durationDays })
      .pipe(catchError(() => of(null)));
  }

  checkout(userId: number): Observable<any> {
    return this.http
      .post<any>(`${this.API}/Cart/checkout`, { userId })
      .pipe(catchError(err => { throw err; }));
  }

  clearCart(userId: number): Observable<any> {
    return this.http
      .delete<any>(`${this.API}/Cart/clear/${userId}`)
      .pipe(catchError(() => of(null)));
  }

  getAnalytics(): Observable<any> {
    return this.http
      .get<any>(`${this.API}/Cart/analytics`)
      .pipe(catchError(() => of(null)));
  }
}