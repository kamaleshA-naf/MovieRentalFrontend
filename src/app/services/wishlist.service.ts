import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface WishlistItem {
  id:           number;
  movieId:      number;
  movieTitle:   string;
  rentalPrice:  number;
  thumbnailUrl: string | null;
  addedDate:    string;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly API = 'https://localhost:7021/api';
  private http = inject(HttpClient);

  wishlist = signal<WishlistItem[]>([]);

  loadWishlist(userId: number): void {
    this.http
      .get<WishlistItem[]>(`${this.API}/Wishlist/user/${userId}`)
      .pipe(catchError(() => of([])))
      .subscribe(w => this.wishlist.set(w ?? []));
  }

  getWishlist(userId: number): Observable<WishlistItem[]> {
    return this.http
      .get<WishlistItem[]>(`${this.API}/Wishlist/user/${userId}`)
      .pipe(catchError(() => of([])));
  }

  isInWishlist(movieId: number): boolean {
    return this.wishlist().some(w => w.movieId === movieId);
  }

  getWishlistItem(movieId: number): WishlistItem | undefined {
    return this.wishlist().find(w => w.movieId === movieId);
  }

  addToWishlist(
    userId: number,
    movieId: number
  ): Observable<WishlistItem> {
    if (this.isInWishlist(movieId)) {
      return new Observable(observer => {
        observer.error({
          error: { message: 'Already in wishlist.' }
        });
      });
    }
    return this.http.post<WishlistItem>(
      `${this.API}/Wishlist`,
      { userId, movieId }
    );
  }

  removeFromWishlist(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/Wishlist/${id}`);
  }
}