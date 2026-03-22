import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MovieService } from '../../../services/movie.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse, MovieUpdateRequest } from '../../../models/movie.model';

@Component({
  selector: 'app-manage-movies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-movies.html',
  styleUrl: './manage-movies.css'
})
export class ManageMoviesComponent implements OnInit {
  movieService   = inject(MovieService);
  auth           = inject(AuthService);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  searchQuery  = signal('');
  deletingId   = signal<number | null>(null);
  editingMovie = signal<MovieResponse | null>(null);
  isUpdating   = signal(false);

  editForm = signal({
    title:       '',
    description: '',
    rentalPrice: 0,
    director:    '',
    releaseYear: 0,
    rating:      0,
    isActive:    true
  });

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.movieService.movies();
    return this.movieService.movies().filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 100);
  }

  openEdit(movie: MovieResponse): void {
    this.editingMovie.set(movie);
    this.editForm.set({
      title:       movie.title,
      description: movie.description,
      rentalPrice: movie.rentalPrice,
      director:    movie.director,
      releaseYear: movie.releaseYear,
      rating:      movie.rating,
      isActive:    movie.isActive
    });
  }

  closeEdit(): void {
    this.editingMovie.set(null);
  }

  updateForm(field: string, value: any): void {
    this.editForm.update(f => ({ ...f, [field]: value }));
  }

  saveEdit(): void {
    const movie = this.editingMovie();
    if (!movie) return;
    this.isUpdating.set(true);

    const req: MovieUpdateRequest = {
      title:       this.editForm().title,
      description: this.editForm().description,
      rentalPrice: this.editForm().rentalPrice,
      director:    this.editForm().director,
      releaseYear: this.editForm().releaseYear,
      rating:      this.editForm().rating,
      isActive:    this.editForm().isActive
    };

    this.movieService.updateMovie(movie.id, req).subscribe({
      next: () => {
        this.toastr.success(`"${movie.title}" updated`, 'Updated');
        this.isUpdating.set(false);
        this.editingMovie.set(null);
        this.movieService.getAllMovies(1, 100);
      },
      error: (err) => {
        this.toastr.error(err.error?.message ?? 'Update failed', 'Error');
        this.isUpdating.set(false);
      }
    });
  }

  deleteMovie(movie: MovieResponse): void {
    if (!confirm(`Delete "${movie.title}"? This cannot be undone.`)) return;
    this.deletingId.set(movie.id);
    this.movieService.deleteMovie(movie.id).subscribe({
      next: () => {
        this.toastr.success(`"${movie.title}" deleted`, 'Deleted');
        this.deletingId.set(null);
        this.movieService.getAllMovies(1, 100);
      },
      error: (err) => {
        this.toastr.error(err.error?.message ?? 'Delete failed', 'Error');
        this.deletingId.set(null);
      }
    });
  }

  toggleActive(movie: MovieResponse): void {
    this.movieService.updateMovie(movie.id, { isActive: !movie.isActive }).subscribe({
      next: () => {
        this.toastr.success(
          `"${movie.title}" ${movie.isActive ? 'deactivated' : 'activated'}`,
          'Updated'
        );
        this.movieService.getAllMovies(1, 100);
      },
      error: () => this.toastr.error('Update failed', 'Error')
    });
  }

  goUpload(): void { this.router.navigate(['/admin/upload']); }
  goBack():   void { this.router.navigate(['/admin/dashboard']); }
}