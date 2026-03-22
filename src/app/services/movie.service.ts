import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MovieResponse } from '../models/movie.model';

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly API  = 'https://localhost:7021/api';
  private readonly BASE = 'https://localhost:7021';
  private http = inject(HttpClient);

  movies    = signal<MovieResponse[]>([]);
  genres    = signal<any[]>([]);
  isLoading = signal(false);

  /**
   * Backend saves /uploads/thumbnails/file.jpg
   * Browser needs https://localhost:7021/uploads/thumbnails/file.jpg
   */
  private fixUrls(m: MovieResponse): MovieResponse {
    return {
      ...m,
      thumbnailUrl: m.thumbnailUrl
        ? (m.thumbnailUrl.startsWith('http')
            ? m.thumbnailUrl
            : this.BASE + m.thumbnailUrl)
        : null,
      videoUrl: m.videoUrl
        ? (m.videoUrl.startsWith('http')
            ? m.videoUrl
            : this.BASE + m.videoUrl)
        : null
    };
  }

  /**
   * Safely extract array from any API response shape:
   * - Array directly: [...]
   * - Paginated: { items: [...], totalCount: N }
   * - Other wrapped: { data: [...] }
   */
  private extractArray(res: any): MovieResponse[] {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && Array.isArray(res.data))  return res.data;
    return [];
  }

  getAllMovies(pageNumber = 1, pageSize = 100): void {
    this.isLoading.set(true);
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    this.http.get<any>(`${this.API}/Movie`, { params }).subscribe({
      next: (res) => {
        const raw = this.extractArray(res);
        this.movies.set(raw.map(m => this.fixUrls(m)));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('getAllMovies error:', err);
        this.movies.set([]);
        this.isLoading.set(false);
      }
    });
  }

  getMovieById(id: number): Observable<MovieResponse> {
    return this.http
      .get<MovieResponse>(`${this.API}/Movie/${id}`)
      .pipe(map(m => this.fixUrls(m)));
  }

  searchMovies(keyword: string, page = 1, size = 20): Observable<any> {
    const params = new HttpParams()
      .set('keyword', keyword)
      .set('pageNumber', page)
      .set('pageSize', size);
    return this.http
      .get<any>(`${this.API}/Movie/search`, { params })
      .pipe(
        map(res => ({
          ...res,
          items: this.extractArray(res).map((m: MovieResponse) => this.fixUrls(m))
        })),
        catchError(() => of({ items: [], totalCount: 0 }))
      );
  }

  getTrendingMovies(): Observable<MovieResponse[]> {
    return this.http
      .get<any>(`${this.API}/Movie/trending`)
      .pipe(
        map(res => this.extractArray(res).map(m => this.fixUrls(m))),
        catchError(() => of([]))
      );
  }

  getMoviesByGenre(genreId: number, page = 1, size = 20): Observable<any> {
    const params = new HttpParams()
      .set('pageNumber', page)
      .set('pageSize', size);
    return this.http
      .get<any>(`${this.API}/Movie/genre/${genreId}`, { params })
      .pipe(
        map(res => ({
          ...res,
          items: this.extractArray(res).map((m: MovieResponse) => this.fixUrls(m))
        })),
        catchError(() => of({ items: [] }))
      );
  }

  addMovie(dto: any): Observable<MovieResponse> {
    return this.http
      .post<MovieResponse>(`${this.API}/Movie/AddMovie`, dto)
      .pipe(map(m => this.fixUrls(m)));
  }

  updateMovie(id: number, dto: any): Observable<MovieResponse> {
    return this.http
      .put<MovieResponse>(`${this.API}/Movie/${id}`, dto)
      .pipe(map(m => this.fixUrls(m)));
  }

  deleteMovie(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API}/Movie/${id}`);
  }

  /** Increment view count when user starts watching */
  incrementView(id: number): Observable<any> {
    return this.http
      .put<any>(`${this.API}/Movie/${id}/view`, {})
      .pipe(catchError(() => of(null))); // silent fail
  }

  uploadThumbnail(movieId: number, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('movieId', movieId.toString());
    return this.http.post<any>(`${this.API}/Movie/upload-thumbnail`, fd);
  }

  uploadVideo(movieId: number, file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('movieId', movieId.toString());
    return this.http.post<any>(`${this.API}/Movie/upload-video`, fd);
  }

  getMovieStats(id: number): Observable<any> {
    return this.http
      .get<any>(`${this.API}/Movie/${id}/stats`)
      .pipe(catchError(() => of(null)));
  }

  loadGenres(): void {
    this.http.get<any[]>(`${this.API}/Genre`).subscribe({
      next: (g) => this.genres.set(Array.isArray(g) ? g : []),
      error: () => this.genres.set([])
    });
  }
}