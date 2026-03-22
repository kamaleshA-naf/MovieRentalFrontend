import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  MovieRatingCreate, MovieRatingResponse, MovieRatingSummary
} from '../models/rating.model';

@Injectable({ providedIn: 'root' })
export class RatingService {
  private readonly API = 'https://localhost:7021/api';
  private http = inject(HttpClient);

  // Local cache: movieId → ratingValue (0 = not rated)
  userRatings = signal<Record<number, number>>({});

  // Rate or toggle-off (send same value = remove)
  rateMovie(
    movieId: number,
    req: MovieRatingCreate
  ): Observable<MovieRatingResponse> {
    return this.http.post<MovieRatingResponse>(
      `${this.API}/Movie/${movieId}/rate`, req
    ).pipe(
      tap(res => {
        // Update local cache
        this.userRatings.update(ratings => ({
          ...ratings,
          [movieId]: res.isRemoved ? 0 : res.ratingValue
        }));
      }),
      catchError(err => {
        console.error('Rate movie error:', err);
        return throwError(() => err);
      })
    );
  }

  // Explicit remove
  removeRating(movieId: number, userId: number): Observable<MovieRatingResponse> {
    return this.http.delete<MovieRatingResponse>(
      `${this.API}/Movie/${movieId}/rate/${userId}`
    ).pipe(
      tap(() => {
        this.userRatings.update(ratings => ({ ...ratings, [movieId]: 0 }));
      }),
      catchError(err => {
        console.error('Remove rating error:', err);
        return throwError(() => err);
      })
    );
  }

  getRatingSummary(movieId: number): Observable<MovieRatingSummary> {
    return this.http.get<MovieRatingSummary>(
      `${this.API}/Movie/${movieId}/ratings`
    ).pipe(
      catchError(err => {
        console.error('Get rating summary error:', err);
        return of({
          movieId, movieTitle: '', averageRating: 0,
          totalRatings: 0, notForMeCount: 0,
          likeCount: 0, loveCount: 0
        });
      })
    );
  }

  getUserRatingForMovie(
    movieId: number, userId: number
  ): Observable<MovieRatingResponse> {
    return this.http.get<MovieRatingResponse>(
      `${this.API}/Movie/${movieId}/rating/user/${userId}`
    ).pipe(
      tap(res => {
        if (res) {
          this.userRatings.update(ratings => ({
            ...ratings,
            [movieId]: res.isRemoved ? 0 : res.ratingValue
          }));
        }
      }),
      catchError(err => {
        console.error('Get user rating error:', err);
        return of({
          id: 0, movieId, movieTitle: '',
          userId, userName: '',
          ratingValue: 0, ratingLabel: 'Not rated',
          ratedAt: '', isRemoved: false
        });
      })
    );
  }

  // Read from local cache
  getLocalRating(movieId: number): number {
    return this.userRatings()[movieId] ?? 0;
  }

  setLocalRating(movieId: number, value: number): void {
    this.userRatings.update(r => ({ ...r, [movieId]: value }));
  }
}