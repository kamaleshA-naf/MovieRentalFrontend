import {
  Component, inject, signal, Input, Output,
  EventEmitter, OnInit, OnChanges, SimpleChanges, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../services/auth.service';
import { MovieService } from '../../../services/movie.service';
import { MovieResponse } from '../../../models/movie.model';
import { environment } from '@env/environment';

@Component({
  selector: 'app-upload-movie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload-movie.html',
  styleUrl: './upload-movie.css'
})
export class UploadMovieComponent implements OnInit, OnChanges {
  // ── Backend routes (match your actual MovieController) ──────
  // POST /api/Movie           ← create
  // PUT  /api/Movie/{id}        ← update
  // POST /api/Movie/upload-thumbnail  ← thumbnail file upload
  // POST /api/Movie/upload-video      ← video file upload
  private readonly API = environment.apiBase;

  @Input()  editMovie: MovieResponse | null = null;
  @Output() uploaded  = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private auth   = inject(AuthService);
  private http   = inject(HttpClient);
  private toastr = inject(ToastrService);
  movieService   = inject(MovieService);

  // ── Form fields ───────────────────────────────────────────────
  title        = signal('');
  description  = signal('');
  director     = signal('');
  releaseYear  = signal(new Date().getFullYear());
  rentalPrice  = signal(0);
  thumbnailUrl = signal('');
  videoUrl     = signal('');
  language     = signal('');
  videoFile    = signal<File | null>(null);
  isDragging   = signal(false);

  selectedGenreIds = signal<number[]>([]);
  newGenreName     = signal('');
  addingGenre      = signal(false);
  isSubmitting     = signal(false);

  // ── Computed ──────────────────────────────────────────────────
  isEditMode = computed(() => !!this.editMovie);

  canSubmit = computed(() =>
    this.title().trim().length > 0 &&
    this.director().trim().length > 0 &&
    this.rentalPrice() > 0 &&
    this.selectedGenreIds().length > 0
    // language is frontend-only display field, not required for submit
  );

  get genreList() { return this.movieService.genres(); }

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.movieService.loadGenres();
    this.populateForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editMovie'] && !changes['editMovie'].firstChange) {
      this.populateForm();
    }
  }

  private populateForm(): void {
    if (this.editMovie) {
      this.title.set(this.editMovie.title ?? '');
      this.description.set(this.editMovie.description ?? '');
      this.director.set(this.editMovie.director ?? '');
      this.releaseYear.set(this.editMovie.releaseYear ?? new Date().getFullYear());
      this.rentalPrice.set(this.editMovie.rentalPrice ?? 0);
      this.thumbnailUrl.set(this.editMovie.thumbnailUrl ?? '');
      this.videoUrl.set((this.editMovie as any).videoUrl ?? '');
      this.language.set((this.editMovie as any).language ?? '');
      this.selectedGenreIds.set(this.editMovie.genres?.map(g => g.id) ?? []);
      this.videoFile.set(null);
    } else {
      this.title.set('');
      this.description.set('');
      this.director.set('');
      this.releaseYear.set(new Date().getFullYear());
      this.rentalPrice.set(0);
      this.thumbnailUrl.set('');
      this.videoUrl.set('');
      this.language.set('');
      this.selectedGenreIds.set([]);
      this.videoFile.set(null);
    }
  }

  // ── Genre helpers ─────────────────────────────────────────────
  isGenreSelected(id: number): boolean {
    return this.selectedGenreIds().includes(id);
  }

  toggleGenre(id: number): void {
    const cur = this.selectedGenreIds();
    this.selectedGenreIds.set(
      cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    );
  }

  addGenre(): void {
    const name = this.newGenreName().trim();
    if (!name) return;
    this.addingGenre.set(true);

    // Your backend may have a separate Genre controller —
    // adjust URL if needed.
    this.http.post<any>(
      `${this.API}/Genre`,
      { name },
      { headers: this.authHeaders() }
    ).subscribe({
      next: () => {
        this.movieService.loadGenres();
        this.newGenreName.set('');
        this.addingGenre.set(false);
        this.toastr.success(`Genre "${name}" added.`);
      },
      error: (err: any) => {
        this.addingGenre.set(false);
        this.toastr.error(err?.error?.message ?? 'Failed to add genre.');
      }
    });
  }

  // ── File drag/drop ────────────────────────────────────────────
  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave(): void { this.isDragging.set(false); }

  onFileDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file?.type.startsWith('video/')) this.videoFile.set(file);
  }

  onFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.videoFile.set(file);
  }

  removeFile(): void { this.videoFile.set(null); }

  formatBytes(b: number): string {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  cancel(): void { this.cancelled.emit(); }

  // ── Submit ────────────────────────────────────────────────────
  submit(): void {
    if (!this.canSubmit() || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    const body: any = {
      title:        this.title().trim(),
      description:  this.description().trim(),
      director:     this.director().trim(),
      releaseYear:  this.releaseYear(),
      rentalPrice:  this.rentalPrice(),
      rating:       0,
      language:     this.language().trim() || 'English',
      thumbnailUrl: this.thumbnailUrl().trim() || null,
      videoUrl:     this.videoUrl().trim()     || null,
      genreIds:     this.selectedGenreIds()
    };

    if (this.isEditMode()) {
      // UPDATE — PUT /api/Movie/{id}
      this.http.put<any>(
        `${this.API}/Movie/${this.editMovie!.id}`,
        body,
        { headers: this.authHeaders() }
      ).subscribe({
        next: (res) => {
          // Patch local editMovie so form stays in sync after save
          if (res && this.editMovie) {
            (this.editMovie as any).videoUrl     = res.videoUrl     ?? null;
            (this.editMovie as any).thumbnailUrl = res.thumbnailUrl ?? null;
            this.videoUrl.set(res.videoUrl ?? '');
            this.thumbnailUrl.set(res.thumbnailUrl ?? '');
          }
          this.onSuccess(res);
        },
        error: (err) => this.onError(err)
      });
    } else {
      // CREATE — POST /api/Movie/add
      this.http.post<any>(
        `${this.API}/Movie/add`,
        body,
        { headers: this.authHeaders() }
      ).subscribe({
        next: (res) => {
          // If a video file was also selected, upload it after creation
          if (this.videoFile() && res?.id) {
            this.uploadVideoFile(res.id);
          } else {
            this.onSuccess(res);
          }
        },
        error: (err) => this.onError(err)
      });
    }
  }

  /**
   * After movie is created, upload the video file via
   * POST /api/Movie/upload-video  (multipart/form-data)
   */
  private uploadVideoFile(movieId: number): void {
    const file = this.videoFile();
    if (!file) { this.onSuccess(null); return; }

    const form = new FormData();
    form.append('File', file);
    form.append('MovieId', movieId.toString());

    this.http.post<any>(
      `${this.API}/Movie/upload-video`,
      form,
      {
        headers: new HttpHeaders({
          Authorization: `Bearer ${this.auth.getToken()}`
          // Note: do NOT set Content-Type for multipart — browser sets it with boundary
        })
      }
    ).subscribe({
      next: () => this.onSuccess(null),
      error: () => {
        // Movie was created successfully — just video upload failed
        this.toastr.warning(
          'Movie added but video upload failed. You can re-upload later.',
          'Partial Success'
        );
        this.isSubmitting.set(false);
        this.uploaded.emit();
      }
    });
  }

  private onSuccess(_res: any): void {
    this.isSubmitting.set(false);
    this.toastr.success(
      this.isEditMode() ? 'Movie updated successfully!' : 'Movie added successfully!',
      'Success'
    );
    this.uploaded.emit();
  }

  private onError(err: any): void {
    this.isSubmitting.set(false);

    // Show the most specific error message available
    const msg =
      err?.error?.message ??
      err?.error?.title ??
      (err.status === 403 ? 'Access denied — check your role permissions.' :
       err.status === 401 ? 'Not authenticated — please log in again.' :
       'Failed to save movie.');

    this.toastr.error(msg, 'Error');

    // Also show individual field validation errors if present
    if (err?.error?.errors) {
      Object.values(err.error.errors)
        .flat()
        .forEach((e: any) => this.toastr.warning(String(e), 'Validation'));
    }
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${this.auth.getToken() ?? ''}`
    });
  }
}