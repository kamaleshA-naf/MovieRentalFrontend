import {
  Component, inject, signal, computed,
  Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { MovieService } from '../../../services/movie.service';
import { GenreResponse } from '../../../models/movie.model';
import { environment } from '@env/environment';

@Component({
  selector: 'app-admin-upload-movie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload-movie.html',
  styleUrl: './upload-movie.css'
})
export class AdminUploadMovieComponent implements OnInit, OnChanges {
  @Input() editMovie: any = null;
  @Output() uploaded  = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private http   = inject(HttpClient);
  private toastr = inject(ToastrService);
  movieService   = inject(MovieService);

  private readonly API = environment.apiBase;

  title             = signal('');
  description       = signal('');
  director          = signal('');
  releaseYear       = signal(new Date().getFullYear());
  rentalPrice       = signal(0);
  videoUrl          = signal('');
  thumbnailUrl      = signal('');
  language          = signal('');
  selectedGenreIds  = signal<number[]>([]);
  newGenreName      = signal('');
  addingGenre       = signal(false);
  videoFile         = signal<File | null>(null);
  isSubmitting      = signal(false);
  isDragging        = signal(false);
  genreDropdownOpen = signal(false);

  canSubmit = computed(() =>
    this.title().trim().length >= 1 &&
    this.director().trim().length >= 1 &&
    this.rentalPrice() > 0 &&
    this.selectedGenreIds().length > 0
    // Language is frontend-only (not stored in DB) — not required for submit
  );

  isEditMode = computed(() => !!this.editMovie);

  ngOnInit(): void {
    // Load genres first, THEN populate form so genre names render correctly
    this.movieService.loadGenres();
    // Small delay to let genres signal settle before populating chips
    setTimeout(() => this.populateForm(), 50);
  }

  // Re-populate when editMovie input changes (e.g. switching between edit targets)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editMovie'] && !changes['editMovie'].firstChange) {
      // Wait for genres to be available
      setTimeout(() => this.populateForm(), 50);
    }
  }

  private populateForm(): void {
    if (this.editMovie) {
      this.title.set(this.editMovie.title ?? '');
      this.description.set(this.editMovie.description ?? '');
      this.director.set(this.editMovie.director ?? '');
      this.releaseYear.set(this.editMovie.releaseYear ?? new Date().getFullYear());
      this.rentalPrice.set(this.editMovie.rentalPrice ?? 0);
      this.videoUrl.set(this.editMovie.videoUrl ?? '');
      this.thumbnailUrl.set(this.editMovie.thumbnailUrl ?? '');
      this.language.set((this.editMovie as any).language ?? '');

      // Map genre IDs from the movie's genres array
      const genreIds = this.editMovie.genres?.map((g: any) => g.id ?? g) ?? [];
      this.selectedGenreIds.set(genreIds);

      this.videoFile.set(null);
      this.genreDropdownOpen.set(false);
    } else {
      // Reset for add mode
      this.title.set('');
      this.description.set('');
      this.director.set('');
      this.releaseYear.set(new Date().getFullYear());
      this.rentalPrice.set(0);
      this.videoUrl.set('');
      this.thumbnailUrl.set('');
      this.language.set('');
      this.selectedGenreIds.set([]);
      this.videoFile.set(null);
      this.genreDropdownOpen.set(false);
    }
  }

  get genreList(): GenreResponse[] {
    return this.movieService.genres();
  }

  getGenreName(id: number): string {
    return this.genreList.find(g => g.id === id)?.name ?? '';
  }

  toggleGenre(id: number): void {
    const cur = this.selectedGenreIds();
    this.selectedGenreIds.set(
      cur.includes(id)
        ? cur.filter(x => x !== id)
        : [...cur, id]
    );
  }

  isGenreSelected(id: number): boolean {
    return this.selectedGenreIds().includes(id);
  }

  addGenre(): void {
    const name = this.newGenreName().trim();
    if (!name) return;
    this.addingGenre.set(true);
    this.http.post<GenreResponse>(
      `${this.API}/Genre`, { name }
    ).subscribe({
      next: (g) => {
        this.toastr.success(`Genre "${g.name}" added`, 'Genre');
        this.movieService.loadGenres();
        this.newGenreName.set('');
        this.addingGenre.set(false);
      },
      error: (err) => {
        this.toastr.error(
          err.error?.message ?? 'Failed to add genre', 'Error'
        );
        this.addingGenre.set(false);
      }
    });
  }

  onFileDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('video/'))
      this.videoFile.set(file);
  }

  onFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.videoFile.set(file);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void { this.isDragging.set(false); }
  removeFile(): void  { this.videoFile.set(null); }

  formatBytes(b: number): string {
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  submit(): void {
    if (!this.canSubmit()) { return; }
    this.isSubmitting.set(true);

    // FIX: send null explicitly when URL is cleared — undefined is ignored by backend
    const rawVideoUrl = this.videoUrl().trim();
    const rawThumbUrl = this.thumbnailUrl().trim();

    const payload: any = {
      title:        this.title().trim(),
      description:  this.description().trim(),
      director:     this.director().trim(),
      releaseYear:  Number(this.releaseYear()),
      rentalPrice:  Number(this.rentalPrice()),
      rating:       0,
      language:     this.language().trim() || 'English',
      genreIds:     this.selectedGenreIds(),
      videoUrl:     rawVideoUrl  || null,
      thumbnailUrl: rawThumbUrl  || null
    };

  if (this.isEditMode()) {
    // ── EDIT ──
    this.movieService.updateMovie(
      this.editMovie.id, payload
    ).subscribe({
      next: (updated) => {
        // Patch editMovie reference so form stays in sync
        this.editMovie = { ...this.editMovie, ...updated };
        this.videoUrl.set(updated.videoUrl ?? '');
        this.thumbnailUrl.set(updated.thumbnailUrl ?? '');
        this.toastr.success('Movie updated successfully!', 'Updated');
        this.isSubmitting.set(false);
        // Force full re-fetch so genres/language update everywhere (home, admin)
        this.movieService.getAllMovies(1, 100);
        this.uploaded.emit();
      },
      error: (err: any) => {
        this.toastr.error(
          err?.error?.message ?? 'Update failed', 'Error'
        );
        this.isSubmitting.set(false);
      }
    });

  } else {
    // ── ADD ──
    this.movieService.addMovie(payload as any).subscribe({
      next: (movie: any) => {
        const movieId = movie?.id ?? movie?.Id;

        if (!movieId) {
          this.toastr.error(
            'Movie created but ID missing.', 'Error'
          );
          this.isSubmitting.set(false);
          return;
        }

        if (this.videoFile()) {
          // Upload video after movie is created
          this.movieService.uploadVideo(
            movieId, this.videoFile()!
          ).subscribe({
            next: () => {
              this.toastr.success(
                '"' + movie.title + '" added with video!',
                'Added'
              );
              this.isSubmitting.set(false);
              this.uploaded.emit();
            },
            error: () => {
              this.toastr.warning(
                'Movie added but video upload failed.',
                'Partial Success'
              );
              this.isSubmitting.set(false);
              this.uploaded.emit();
            }
          });
        } else {
          this.toastr.success(
            '"' + (movie.title ?? 'Movie') + '" added!',
            'Added'
          );
          this.isSubmitting.set(false);
          this.uploaded.emit();
        }
      },
      error: (err: any) => {
        // Show the most specific error — validation errors come in err.error.errors
        let msg = err?.error?.message ?? err?.error?.title ?? 'Failed to add movie';
        if (err?.error?.errors) {
          const fields = Object.entries(err.error.errors)
            .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
            .join(' | ');
          msg = fields || msg;
        }
        this.toastr.error(msg, 'Error', { timeOut: 8000 });
        console.error('[AddMovie] error:', err?.error);
        this.isSubmitting.set(false);
      }
    });
  }
}

  cancel(): void { this.cancelled.emit(); }
}