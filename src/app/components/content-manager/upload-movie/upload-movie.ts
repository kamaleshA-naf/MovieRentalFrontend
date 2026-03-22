import {
  Component, inject, signal, computed,
  Input, Output, EventEmitter, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { MovieService } from '../../../services/movie.service';
import { GenreResponse } from '../../../models/movie.model';

@Component({
  selector: 'app-upload-movie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload-movie.html',
  styleUrl: './upload-movie.css'
})
export class UploadMovieComponent implements OnInit {
  @Input() editMovie: any = null;
  @Output() uploaded  = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private http   = inject(HttpClient);
  private toastr = inject(ToastrService);
  movieService   = inject(MovieService);

  private readonly API = 'https://localhost:7021/api';

  title            = signal('');
  description      = signal('');
  director         = signal('');
  releaseYear      = signal(new Date().getFullYear());
  rentalPrice      = signal(0);
  videoUrl         = signal('');
  thumbnailUrl     = signal('');
  selectedGenreIds = signal<number[]>([]);
  newGenreName     = signal('');
  addingGenre      = signal(false);
  videoFile        = signal<File | null>(null);
  isSubmitting     = signal(false);
  isDragging       = signal(false);

  canSubmit = computed(() =>
    this.title().trim().length >= 1 &&
    this.director().trim().length >= 1 &&
    this.rentalPrice() > 0
  );

  isEditMode = computed(() => !!this.editMovie);

  ngOnInit(): void {
    this.movieService.loadGenres();
    if (this.editMovie) {
      this.title.set(this.editMovie.title ?? '');
      this.description.set(this.editMovie.description ?? '');
      this.director.set(this.editMovie.director ?? '');
      this.releaseYear.set(
        this.editMovie.releaseYear ?? new Date().getFullYear()
      );
      this.rentalPrice.set(this.editMovie.rentalPrice ?? 0);
      this.videoUrl.set(this.editMovie.videoUrl ?? '');
      this.thumbnailUrl.set(this.editMovie.thumbnailUrl ?? '');
      this.selectedGenreIds.set(
        this.editMovie.genres?.map((g: any) => g.id) ?? []
      );
    }
  }

  get genreList(): GenreResponse[] {
    return this.movieService.genres();
  }

  toggleGenre(id: number): void {
    const cur = this.selectedGenreIds();
    this.selectedGenreIds.set(
      cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    );
  }

  isGenreSelected(id: number): boolean {
    return this.selectedGenreIds().includes(id);
  }

  addGenre(): void {
    const name = this.newGenreName().trim();
    if (!name) return;
    this.addingGenre.set(true);
    this.http.post<GenreResponse>(`${this.API}/Genre`, { name }).subscribe({
      next: (g) => {
        this.toastr.success(`Genre "${g.name}" added`, 'Genre');
        this.movieService.loadGenres();
        this.newGenreName.set('');
        this.addingGenre.set(false);
      },
      error: (err) => {
        this.toastr.error(err.error?.message ?? 'Failed', 'Error');
        this.addingGenre.set(false);
      }
    });
  }

  onFileDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('video/')) this.videoFile.set(file);
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

  const payload = {
    title:        this.title(),
    description:  this.description(),
    director:     this.director(),
    releaseYear:  this.releaseYear(),
    rentalPrice:  this.rentalPrice(),
    rating:       0,
    genreIds:     this.selectedGenreIds(),
    videoUrl:     this.videoUrl()     || undefined,
    thumbnailUrl: this.thumbnailUrl() || undefined,
    isActive:     true
  };

  if (this.isEditMode()) {
    // ── EDIT ──
    this.movieService.updateMovie(
      this.editMovie.id, payload
    ).subscribe({
      next: () => {
        this.toastr.success(
          'Movie updated successfully!', 'Updated'
        );
        this.isSubmitting.set(false);
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
        this.toastr.error(
          err?.error?.message ?? 'Failed to add movie',
          'Error'
        );
        this.isSubmitting.set(false);
      }
    });
  }
}

  cancel(): void { this.cancelled.emit(); }
}