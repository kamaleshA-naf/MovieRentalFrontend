import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseMovie } from '../../../models/browse.model';
import { BrowseCardComponent } from '../movie-card/movie-card';

@Component({
  selector: 'app-movie-row',
  standalone: true,
  imports: [CommonModule, BrowseCardComponent],
  templateUrl: './movie-row.html',
  styleUrl: './movie-row.css'
})
export class MovieRowComponent {
  title  = input.required<string>();
  movies = input.required<BrowseMovie[]>();
  badge  = input<string>('');

  // How many cards visible at once
  readonly PAGE = 5;

  startIndex = signal(0);

  visibleMovies = computed(() => {
    const list = this.movies();
    if (!list.length) return [];
    const start = this.startIndex();
    // Build a window of PAGE items with circular wrapping
    const result: BrowseMovie[] = [];
    for (let i = 0; i < this.PAGE; i++) {
      result.push(list[(start + i) % list.length]);
    }
    return result;
  });

  canScroll = computed(() => this.movies().length > this.PAGE);

  prev(): void {
    const len = this.movies().length;
    if (!len) return;
    this.startIndex.update(i => (i - 1 + len) % len);
  }

  next(): void {
    const len = this.movies().length;
    if (!len) return;
    this.startIndex.update(i => (i + 1) % len);
  }
}
