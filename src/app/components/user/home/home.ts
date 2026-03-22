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
import { CartService }   from '../../../services/cart.service';
import { NavbarComponent } from '../../shared/navbar/navbar';
import { MovieResponse, GenreResponse } from '../../../models/movie.model';
import { ToastrService } from 'ngx-toastr';

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
  cartService   = inject(CartService);
  auth          = inject(AuthService);
  private toastr = inject(ToastrService);

  searchQuery    = signal('');
  selectedGenre  = signal('All');
  addingToCart   = signal<number | null>(null);

  readonly PLACEHOLDER = 'assets/images/placeholders/movie-placeholder.svg';

  ngOnInit(): void {
    this.movieService.getAllMovies(1, 100);
    this.movieService.loadGenres();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (userId > 0) {
      this.rentalService.loadMyRentals(userId);
      this.cartService.loadCart(userId);
    }
  }

  allMovies     = computed(() => this.movieService.movies());
  featuredMovie = computed(() => {
    const movies = this.allMovies();
    return movies.find((m: MovieResponse) => m.thumbnailUrl) ?? movies[0] ?? null;
  });
  heroBg = computed(() => {
    const m = this.featuredMovie();
    return m?.thumbnailUrl ? `url(${m.thumbnailUrl})` : '';
  });
  genres = computed(() => {
    const set = new Set<string>(['All']);
    this.allMovies().forEach((m: MovieResponse) =>
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
      .sort((a: MovieResponse, b: MovieResponse) => b.viewCount - a.viewCount)
      .slice(0, 10)
  );
  newMovies = computed(() =>
    [...this.allMovies()]
      .sort((a: MovieResponse, b: MovieResponse) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10)
  );
  actionMovies = computed(() =>
    this.allMovies()
      .filter((m: MovieResponse) => m.genres.some((g: GenreResponse) => g.name === 'Action'))
      .slice(0, 10)
  );
  scifiMovies = computed(() =>
    this.allMovies()
      .filter((m: MovieResponse) => m.genres.some((g: GenreResponse) => g.name === 'Sci-Fi'))
      .slice(0, 10)
  );
  dramaMovies = computed(() =>
    this.allMovies()
      .filter((m: MovieResponse) => m.genres.some((g: GenreResponse) => g.name === 'Drama'))
      .slice(0, 10)
  );

  hasAccess(movieId: number): boolean {
    return this.rentalService.hasActiveRental(movieId);
  }

  isInCart(movieId: number): boolean {
    return this.cartService.isInCart(movieId);
  }

  addToCart(event: Event, movie: MovieResponse): void {
    event.stopPropagation();
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId || this.addingToCart() === movie.id) return;

    if (this.cartService.isInCart(movie.id)) {
      this.toastr.warning(`"${movie.title}" is already in your cart.`, 'Already in Cart');
      return;
    }

    this.addingToCart.set(movie.id);
    this.cartService.addToCart({ userId, movieId: movie.id, durationDays: 7 }).subscribe({
      next: () => {
        this.cartService.loadCart(userId);
        this.addingToCart.set(null);
        this.toastr.success(`"${movie.title}" added to cart!`, 'Added 🛒');
      },
      error: (err: any) => {
        this.addingToCart.set(null);
        if (err?.status === 409) {
          this.cartService.loadCart(userId);
          this.toastr.warning(`"${movie.title}" is already in your cart.`, 'Already in Cart');
        } else {
          this.toastr.error(err?.error?.message ?? 'Could not add to cart.', 'Error');
        }
      }
    });
  }

  posterUrl(movie: MovieResponse): string {
    return movie.thumbnailUrl ?? this.PLACEHOLDER;
  }

  scroll(el: HTMLElement, dir: 'left' | 'right'): void {
    el.scrollBy({ left: dir === 'right' ? 320 : -320, behavior: 'smooth' });
  }

  trackById(index: number, movie: MovieResponse): number {
    return movie.id;
  }
}