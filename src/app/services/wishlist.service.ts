import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';

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
  private readonly API  = environment.apiBase;
  private readonly BASE = environment.mediaBase;
  private http = inject(HttpClient);

  wishlist = signal<WishlistItem[]>([]);

  /**
   * Fix URL only if it's a RELATIVE path (starts with /).
   * If it's already an absolute URL (http/https) — leave it as-is.
   * Backend WishlistResponseDto returns ThumbnailUrl which is absolute.
   */
  private fixUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Relative path — prefix with backend base URL
    return this.BASE + (url.startsWith('/') ? url : '/' + url);
  }

  private normalize(raw: any): WishlistItem {
    return {
      id:           raw.id          ?? raw.Id,
      movieId:      raw.movieId     ?? raw.MovieId,
      movieTitle:   raw.movieTitle  ?? raw.MovieTitle  ?? '',
      rentalPrice:  raw.rentalPrice ?? raw.RentalPrice ?? 0,
      thumbnailUrl: this.fixUrl(raw.thumbnailUrl ?? raw.ThumbnailUrl),
      addedDate:    raw.addedDate   ?? raw.AddedDate   ?? raw.addedAt ?? raw.AddedAt ?? ''
    };
  }

  loadWishlist(userId: number): void {
    this.http
      .get<any[]>(`${this.API}/Wishlist/user/${userId}`)
      .pipe(
        map(items => (Array.isArray(items) ? items : []).map(i => this.normalize(i))),
        catchError(() => of([]))
      )
      .subscribe(w => this.wishlist.set(w));
  }

  isInWishlist(movieId: number): boolean {
    return this.wishlist().some(w => w.movieId === movieId);
  }

  getWishlistItem(movieId: number): WishlistItem | undefined {
    return this.wishlist().find(w => w.movieId === movieId);
  }

  addToWishlist(userId: number, movieId: number): Observable<WishlistItem> {
    return this.http
      .post<any>(`${this.API}/Wishlist`, { userId, movieId })
      .pipe(map(item => this.normalize(item)));
  }

  removeFromWishlist(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/Wishlist/${id}`);
  }
}