import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpContext, HttpContextToken } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { MovieResponse } from '../models/movie.model';
import { environment } from '@env/environment';

/** Skip global error interceptor for fire-and-forget calls */
export const SKIP_ERROR_INTERCEPTOR = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class MovieService {
  private readonly API  = environment.apiBase;
  private readonly BASE = environment.mediaBase;
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
      thumbnailUrl: this.resolveThumbnail(m.thumbnailUrl),
      videoUrl: m.videoUrl
        ? (m.videoUrl.startsWith('http')
            ? m.videoUrl
            : this.BASE + m.videoUrl)
        : null
    };
  }

  /** Convert any thumbnail URL to a usable form.
   *  YouTube img URLs (img.youtube.com) are blocked by CORS/hotlink — use hqdefault instead.
   *  Local paths get the base URL prepended.
   */
  private resolveThumbnail(url: string | null | undefined): string | null {
    if (!url) return null;

    if (url.startsWith('http')) {
      // YouTube thumbnail — extract video ID and use hqdefault
      const ytMatch = url.match(
        /(?:youtube\.com\/vi\/|youtu\.be\/|youtube\.com\/embed\/)([^/?&]+)/
      );
      if (ytMatch) {
        return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
      }
      // TMDB URLs (image.tmdb.org) — these often 404 without an API key.
      // Return as-is and let the (error) handler in the template show the placeholder.
      return url;
    }

    // Local path — prepend base
    return this.BASE + url;
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

  /**
   * GET /api/Movie?pageNumber=1&pageSize=N
   * Response: { data: [...], totalCount, totalPages, hasNext, hasPrevious }
   * We request pageSize=200 to get all movies in one call.
   */
  getAllMovies(pageNumber = 1, pageSize = 200): void {
    this.isLoading.set(true);
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);

    this.http.get<any>(`${this.API}/Movie`, { params }).subscribe({
      next: (res) => {
        // Backend returns { data: [...], totalCount, totalPages, ... }
        const raw = this.extractArray(res);
        const mapped = raw.map(m => this.fixUrls(m));
        this.movies.set(mapped);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[MovieService] getAllMovies error:', err);
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


  getTrendingMovies(): Observable<MovieResponse[]> {
    return this.http
      .get<any>(`${this.API}/Movie/trending`)
      .pipe(
        map(res => this.extractArray(res).map(m => this.fixUrls(m))),
        catchError(() => {
          // Fallback: sort local signal by viewCount if trending endpoint doesn't exist
          const local = [...this.movies()]
            .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
            .slice(0, 10);
          return of(local);
        })
      );
  }


  addMovie(dto: any): Observable<MovieResponse> {
    // Backend route: POST /api/Movie/add
    return this.http
      .post<MovieResponse>(`${this.API}/Movie/add`, dto)
      .pipe(map(m => this.fixUrls(m)));
  }

  updateMovie(id: number, dto: any): Observable<MovieResponse> {
    return this.http
      .put<MovieResponse>(`${this.API}/Movie/${id}`, dto)
      .pipe(
        map(m => this.fixUrls(m)),
        map(updated => {
          // Patch in-place — merge all fields including genres and language
          this.movies.update(list =>
            list.map(m => m.id === updated.id ? { ...m, ...updated } : m)
          );
          return updated;
        }),
        catchError(err => {
          if (dto.isActive !== undefined) {
            this.movies.update(list =>
              list.map(m => m.id === id ? { ...m, isActive: dto.isActive } : m)
            );
          }
          throw err;
        })
      );
  }

  /** Re-fetch a single movie and patch it into the signal — call after edit */
  refreshMovie(id: number): void {
    this.getMovieById(id).subscribe({
      next: (updated) => {
        this.movies.update(list =>
          list.map(m => m.id === updated.id ? { ...m, ...updated } : m)
        );
      },
      error: () => {}
    });
  }

  deleteMovie(id: number): Observable<any> {
    return this.http.delete<any>(`${this.API}/Movie/${id}`).pipe(
      map(res => {
        // Remove from local signal immediately — no re-fetch needed
        this.movies.update(list => list.filter(m => m.id !== id));
        return res;
      })
    );
  }

  /** Increment view count — POST /api/Movie/{id}/view */
  incrementView(id: number): Observable<any> {
    // Optimistic UI update immediately in local signal
    this.movies.update(list =>
      list.map(m => m.id === id ? { ...m, viewCount: (m.viewCount ?? 0) + 1 } : m)
    );

    const ctx = new HttpContext().set(SKIP_ERROR_INTERCEPTOR, true);

    return this.http.post<any>(
      `${this.API}/Movie/${id}/view`, {},
      { context: ctx }
    ).pipe(
      catchError((err) => {
        console.error('[incrementView] failed:', err?.status, err?.message);
        return of(null);
      }),
      tap(() => this.refreshTrendingFromApi())
    );
  }

  /** Pull fresh viewCounts from the trending endpoint and patch into signal */
  private refreshTrendingFromApi(): void {
    this.http.get<any>(`${this.API}/Movie/trending?top=50`)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (!res) return;
        const trending = this.extractArray(res);
        if (!trending.length) return;
        // Patch viewCount for each movie returned by trending
        this.movies.update(list =>
          list.map(m => {
            const t = trending.find((t: any) => t.id === m.id);
            return t ? { ...m, viewCount: t.viewCount ?? m.viewCount } : m;
          })
        );
      });
  }

  uploadThumbnail(movieId: number, file: File): Observable<any> {
    const fd = new FormData();
    // Field names must match backend exactly (case-sensitive): File, MovieId
    fd.append('File', file);
    fd.append('MovieId', movieId.toString());
    return this.http.post<any>(`${this.API}/Movie/upload-thumbnail`, fd);
  }

  uploadVideo(movieId: number, file: File): Observable<any> {
    const fd = new FormData();
    // Field names must match backend exactly (case-sensitive): File, MovieId
    fd.append('File', file);
    fd.append('MovieId', movieId.toString());
    return this.http.post<any>(`${this.API}/Movie/upload-video`, fd);
  }


  loadGenres(): void {
    this.http.get<any[]>(`${this.API}/Genre`).subscribe({
      next: (g) => this.genres.set(Array.isArray(g) ? g : []),
      error: () => this.genres.set([])
    });
  }

  /** Paginated fetch for carousel infinite scroll — appends to caller's array */
  getMoviesPage(page: number, pageSize = 10): Observable<{ items: MovieResponse[]; hasMore: boolean; totalCount: number }> {
    const params = new HttpParams()
      .set('pageNumber', page)
      .set('pageSize', pageSize);
    return this.http.get<any>(`${this.API}/Movie`, { params }).pipe(
      map(res => {
        const items = this.extractArray(res).map(m => this.fixUrls(m));
        const totalCount = res?.totalCount ?? res?.total ?? items.length;
        const totalPages = res?.totalPages ?? Math.ceil(totalCount / pageSize);
        return { items, hasMore: page < totalPages, totalCount };
      }),
      catchError(() => of({ items: [], hasMore: false, totalCount: 0 }))
    );
  }
}