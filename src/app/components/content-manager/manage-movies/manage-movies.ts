import {
  Component, inject, signal, OnInit
} from '@angular/core';
import { CommonModule }      from '@angular/common';
import { FormsModule }       from '@angular/forms';
import { MovieService }      from '../../../services/movie.service';
import { AuthService }       from '../../../services/auth.service';
import { ToastrService }     from 'ngx-toastr';
import { MovieResponse }     from '../../../models/movie.model';
import { UploadMovieComponent }
  from '../upload-movie/upload-movie';

@Component({
  selector: 'app-cm-manage-movies',
  standalone: true,
  imports: [CommonModule, FormsModule, UploadMovieComponent],
  templateUrl: './manage-movies.html',   // ← correct filename
  styleUrl:    './manage-movies.css'     // ← correct filename
})
export class CmManageMoviesComponent implements OnInit {
  movieService   = inject(MovieService);
  private auth   = inject(AuthService);
  private toastr = inject(ToastrService);

  showUpload   = signal(false);
  editingMovie = signal<MovieResponse | null>(null);
  searchQuery  = signal('');

  readonly placeholder =
    'assets/images/placeholders/movie-placeholder.svg';

  filteredMovies() {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.movieService.movies();
    return this.movieService.movies().filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q)
    );
  }

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 100);
    this.movieService.loadGenres();
  }

  edit(movie: MovieResponse): void {
    this.editingMovie.set(movie);
    this.showUpload.set(true);
  }

  openAdd(): void {
    this.editingMovie.set(null);
    this.showUpload.set(true);
  }

  onSaved(): void {
    this.showUpload.set(false);
    this.editingMovie.set(null);
    this.movieService.getAllMovies(1, 100);
    this.toastr.success('Movie saved!', 'Success');
  }

  onCancelled(): void {
    this.showUpload.set(false);
    this.editingMovie.set(null);
  }
}