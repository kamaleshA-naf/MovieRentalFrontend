import {
  Component, inject, signal, computed,
  OnInit, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { RouterLink }    from '@angular/router';
import { FormsModule }   from '@angular/forms';
import { MovieService }  from '../../../services/movie.service';
import { RentalService } from '../../../services/rental.service';
import { AuthService }   from '../../../services/auth.service';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { MovieResponse, GenreResponse }
  from '../../../models/movie.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, NavbarComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  movieService  = inject(MovieService);
  rentalService = inject(RentalService);
  auth          = inject(AuthService);

  searchQuery   = signal('');
  selectedGenre = signal('All');

  readonly PLACEHOLDER =
    'assets/images/placeholders/movie-placeholder.svg';

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 100);
    this.movieService.loadGenres();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (userId > 0) this.rentalService.loadMyRentals(userId);
  }

  allMovies = computed(() => this.movieService.movies());

  featuredMovie = computed(() => {
    const movies = this.allMovies();
    return movies.find(
      (m: MovieResponse) => m.thumbnailUrl
    ) ?? movies[0] ?? null;
  });

  heroBg = computed(() => {
    const m = this.featuredMovie();
    return m?.thumbnailUrl ? `url(${m.thumbnailUrl})` : '';
  });

  genres = computed(() => {
    const all = this.allMovies();
    const set = new Set<string>(['All']);
    all.forEach((m: MovieResponse) =>
      m.genres.forEach((g: GenreResponse) => set.add(g.name))
    );
    return Array.from(set);
  });

  greeting = computed(() => {
    const h    = new Date().getHours();
    const name = this.auth.currentUser()?.userName ?? '';
    if (h < 12) return `Good morning, ${name}`;
    if (h < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  });

  filteredMovies = computed(() => {
    let list = this.allMovies();
    const q = this.searchQuery().toLowerCase().trim();
    const g = this.selectedGenre();
    if (q) {
      list = list.filter((m: MovieResponse) =>
        m.title.toLowerCase().includes(q) ||
        m.director.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    }
    if (g !== 'All') {
      list = list.filter((m: MovieResponse) =>
        m.genres.some((genre: GenreResponse) => genre.name === g)
      );
    }
    return list;
  });

  trendingMovies = computed(() =>
    [...this.allMovies()]
      .sort((a: MovieResponse, b: MovieResponse) =>
        b.viewCount - a.viewCount
      )
      .slice(0, 10)
  );

  newMovies = computed(() =>
    [...this.allMovies()]
      .sort((a: MovieResponse, b: MovieResponse) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      )
      .slice(0, 10)
  );

  actionMovies = computed(() =>
    this.allMovies()
      .filter((m: MovieResponse) =>
        m.genres.some((g: GenreResponse) => g.name === 'Action')
      )
      .slice(0, 10)
  );

  scifiMovies = computed(() =>
    this.allMovies()
      .filter((m: MovieResponse) =>
        m.genres.some(
          (g: GenreResponse) => g.name === 'Sci-Fi'
        )
      )
      .slice(0, 10)
  );

  dramaMovies = computed(() =>
    this.allMovies()
      .filter((m: MovieResponse) =>
        m.genres.some((g: GenreResponse) => g.name === 'Drama')
      )
      .slice(0, 10)
  );

  hasAccess(movieId: number): boolean {
    return this.rentalService.hasActiveRental(movieId);
  }

  posterUrl(movie: MovieResponse): string {
    return movie.thumbnailUrl ?? this.PLACEHOLDER;
  }

  scroll(el: HTMLElement, dir: 'left' | 'right'): void {
    el.scrollBy({
      left:     dir === 'right' ? 320 : -320,
      behavior: 'smooth'
    });
  }

  trackById(index: number, movie: MovieResponse): number {
    return movie.id;
  }
}