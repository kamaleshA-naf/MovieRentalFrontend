import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MovieService } from '../../../services/movie.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse } from '../../../models/movie.model';
import { UploadMovieComponent } from '../upload-movie/upload-movie';

@Component({
  selector: 'app-cm-dashboard',
  standalone: true,
  imports: [CommonModule, UploadMovieComponent],
  templateUrl: './cm-dashboard.html',
  styleUrl: './cm-dashboard.css'
})
export class CmDashboardComponent implements OnInit {
  movieService = inject(MovieService);
  auth         = inject(AuthService);
  toastr       = inject(ToastrService);

  activeTab    = signal<'movies' | 'upload' | 'edit'>('movies');
  deletingId   = signal<number | null>(null);
  editingMovie = signal<MovieResponse | null>(null);

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 100);
    this.movieService.loadGenres();
  }

  openAdd(): void    { this.editingMovie.set(null); this.activeTab.set('upload'); }
  openEdit(m: MovieResponse): void { this.editingMovie.set(m); this.activeTab.set('edit'); }
  onUploaded(): void  { this.activeTab.set('movies'); this.editingMovie.set(null); this.movieService.getAllMovies(1, 100); }
  onCancelled(): void { this.activeTab.set('movies'); this.editingMovie.set(null); }

  deleteMovie(movie: MovieResponse): void {
    if (!confirm(`Delete "${movie.title}"?`)) return;
    this.deletingId.set(movie.id);
    this.movieService.deleteMovie(movie.id).subscribe({
      next: () => {
        this.toastr.success(`"${movie.title}" deleted`, 'Deleted');
        this.deletingId.set(null);
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message ?? 'Delete failed', 'Error');
        this.deletingId.set(null);
      }
    });
  }
}