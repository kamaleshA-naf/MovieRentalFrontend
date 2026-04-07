import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MovieService } from '../../../services/movie.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse, MovieUpdateRequest } from '../../../models/movie.model';

interface ConfirmState {
  show:    boolean;
  title:   string;
  message: string;
  danger:  boolean;
  onYes:   () => void;
}

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
  ratingFilter = signal<'all'|'love'|'like'|'dislike'|'total'>('all');
  deletingId   = signal<number | null>(null);
  editingMovie = signal<MovieResponse | null>(null);
  isUpdating   = signal(false);

  confirmState = signal<ConfirmState>({
    show: false, title: '', message: '', danger: true, onYes: () => {}
  });

  editForm = signal({
    title:       '',
    description: '',
    rentalPrice: 0,
    director:    '',
    releaseYear: 0,
    rating:      0
  });

  // pagination + sort
  page        = signal(0);
  sortCol     = signal<'title'|'price'|'year'|'rating'>('title');
  sortDir     = signal<'asc'|'desc'>('asc');
  readonly PAGE_SIZE = 20;

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const rf = this.ratingFilter();
    let list = this.movieService.movies().filter(m =>
      !q || m.title.toLowerCase().includes(q) || m.director.toLowerCase().includes(q)
    );
    if (rf === 'love')    list = list.filter(m => (m.rating ?? 0) >= 2.5);
    if (rf === 'like')    list = list.filter(m => (m.rating ?? 0) >= 1.5 && (m.rating ?? 0) < 2.5);
    if (rf === 'dislike') list = list.filter(m => (m.rating ?? 0) > 0 && (m.rating ?? 0) < 1.5);
    // sort
    const col = this.sortCol();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    if (col === 'title')  list = [...list].sort((a,b) => dir * a.title.localeCompare(b.title));
    if (col === 'price')  list = [...list].sort((a,b) => dir * (a.rentalPrice - b.rentalPrice));
    if (col === 'year')   list = [...list].sort((a,b) => dir * (a.releaseYear - b.releaseYear));
    if (col === 'rating') list = [...list].sort((a,b) => dir * ((a.rating??0) - (b.rating??0)));
    if (rf === 'total')   list = [...list].sort((a,b) => (b.rating??0) - (a.rating??0));
    return list;
  });

  pagedMovies = computed(() => {
    const p = this.page();
    return this.filtered().slice(p * this.PAGE_SIZE, (p + 1) * this.PAGE_SIZE);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.PAGE_SIZE))
  );

  toggleSort(col: 'title'|'price'|'year'|'rating'): void {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
    this.page.set(0);
  }

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 100);  // admin view
  }

  // ── CONFIRM MODAL ─────────────────────────────────────────

  private showConfirm(
    title: string, message: string, danger: boolean, onYes: () => void
  ): void {
    this.confirmState.set({ show: true, title, message, danger, onYes });
  }

  closeConfirm(): void {
    this.confirmState.set({
      show: false, title: '', message: '', danger: true, onYes: () => {}
    });
  }

  // ── EDIT ──────────────────────────────────────────────────

  openEdit(movie: MovieResponse): void {
    this.editingMovie.set(movie);
    this.editForm.set({
      title:       movie.title,
      description: movie.description,
      rentalPrice: movie.rentalPrice,
      director:    movie.director,
      releaseYear: movie.releaseYear,
      rating:      movie.rating
    });
  }

  closeEdit(): void { this.editingMovie.set(null); }

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
      rating:      this.editForm().rating
    };

    this.movieService.updateMovie(movie.id, req).subscribe({
      next: () => {
        this.toastr.success(`"${movie.title}" updated successfully.`, 'Updated');
        this.isUpdating.set(false);
        this.editingMovie.set(null);
        // Signal already patched in-place by updateMovie() — no re-fetch needed
      },
      error: (err) => {
        this.toastr.error(err.error?.message ?? 'Update failed.', 'Error');
        this.isUpdating.set(false);
      }
    });
  }

  // ── DELETE (soft delete — sets isActive=false) ────────────

  deleteMovie(movie: MovieResponse): void {
    this.showConfirm(
      'Delete Movie',
      `Delete "${movie.title}"? This cannot be undone.`,
      true,
      () => {
        this.closeConfirm();
        this.deletingId.set(movie.id);
        this.movieService.deleteMovie(movie.id).subscribe({
          next: () => {
            this.toastr.success(`"${movie.title}" deleted.`, 'Deleted');
            this.deletingId.set(null);
          },
          error: (err) => {
            this.toastr.error(err.error?.message ?? 'Delete failed.', 'Error');
            this.deletingId.set(null);
          }
        });
      }
    );
  }

  goUpload(): void { this.router.navigate(['/admin/upload']); }
  goBack():   void { this.router.navigate(['/admin/dashboard']); }
}