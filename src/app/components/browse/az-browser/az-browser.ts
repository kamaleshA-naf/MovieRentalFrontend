import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseCardComponent } from '../movie-card/movie-card';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

@Component({
  selector: 'app-az-browser',
  standalone: true,
  imports: [CommonModule, BrowseCardComponent],
  templateUrl: './az-browser.html',
  styleUrl: './az-browser.css'
})
export class AzBrowserComponent {
  store    = inject(BrowseStore);
  selected = signal('');
  alphabet = ALPHABET;

  results = computed(() =>
    this.selected() ? this.store.byLetter(this.selected()) : []
  );

  hasMovies(l: string): boolean {
    return this.store.byLetter(l).length > 0;
  }

  select(l: string): void {
    this.selected.set(this.selected() === l ? '' : l);
  }
}
