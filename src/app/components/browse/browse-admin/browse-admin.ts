import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';
import { BrowseToastComponent } from '../toast/browse-toast';
import { BrowseMovie } from '../../../models/browse.model';

type AdminTab = 'add' | 'languages' | 'genres' | 'list';

interface FormErrors {
  title?:    string;
  language?: string;
  genres?:   string;
  thumb?:    string;
  year?:     string;
  price?:    string;
}

@Component({
  selector: 'app-browse-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BrowseToastComponent],
  templateUrl: './browse-admin.html',
  styleUrl:    './browse-admin.css'
})
export class BrowseAdminComponent {
  store = inject(BrowseStore);
  toast = inject(BrowseToastService);

  activeTab = signal<AdminTab>('add');

  // ── Language manager ───────────────────────────────────────────
  newLang      = signal('');
  langSelected = signal('');   // for the dropdown preview

  addLanguage(): void {
    const err = this.store.addLanguage(this.newLang());
    if (err) { this.toast.error(err); return; }
    this.toast.success(`Language "${this.newLang().trim()}" added.`);
    this.newLang.set('');
  }

  // ── Genre manager ──────────────────────────────────────────────
  newGenre = signal('');

  addGenre(): void {
    const err = this.store.addGenre(this.newGenre());
    if (err) { this.toast.error(err); return; }
    this.toast.success(`Genre "${this.newGenre().trim()}" added.`);
    this.newGenre.set('');
  }

  // ── Add Movie form ─────────────────────────────────────────────
  title          = signal('');
  description    = signal('');
  director       = signal('');
  releaseYear    = signal<number | null>(null);
  pricePerDay    = signal<number | null>(null);
  thumbnail      = signal('');
  videoUrl       = signal('');
  language       = signal('');
  selectedGenres = signal<string[]>([]);
  isTrending     = signal(false);
  isNew          = signal(false);
  topTen         = signal(false);

  errors     = signal<FormErrors>({});
  thumbError = signal(false);

  // Submit button disabled when no languages exist
  canSubmit = computed(() => this.store.languages().length > 0);

  toggleGenre(g: string): void {
    const cur = this.selectedGenres();
    this.selectedGenres.set(
      cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g]
    );
  }

  validate(): boolean {
    const e: FormErrors = {};
    if (!this.title().trim())            e.title    = 'Title is required.';
    if (!this.language())                e.language = 'Please select a language.';
    if (!this.selectedGenres().length)   e.genres   = 'Select at least one genre.';
    if (!this.thumbnail().trim())        e.thumb    = 'Thumbnail URL is required.';
    const yr = this.releaseYear();
    if (!yr || yr < 1900 || yr > new Date().getFullYear() + 2)
      e.year = 'Enter a valid release year.';
    const pr = this.pricePerDay();
    if (!pr || pr <= 0) e.price = 'Enter a valid price.';
    this.errors.set(e);
    return Object.keys(e).length === 0;
  }

  submit(): void {
    if (!this.language())             { this.toast.error('Language is required.');            return; }
    if (!this.selectedGenres().length){ this.toast.error('Select at least one genre.');       return; }
    if (!this.validate())             return;

    const movie: Omit<BrowseMovie, 'id'> = {
      title:       this.title().trim(),
      description: this.description().trim(),
      director:    this.director().trim(),
      releaseYear: this.releaseYear()!,
      pricePerDay: this.pricePerDay()!,
      thumbnail:   this.thumbnail().trim(),
      videoUrl:    this.videoUrl().trim(),
      language:    this.language(),
      genres:      this.selectedGenres(),
      isTrending:  this.isTrending(),
      isNew:       this.isNew(),
      topTen:      this.topTen(),
    };

    this.store.addMovie(movie);
    this.toast.success(`"${movie.title}" added successfully!`);
    this.resetForm();
  }

  resetForm(): void {
    this.title.set('');
    this.description.set('');
    this.director.set('');
    this.releaseYear.set(null);
    this.pricePerDay.set(null);
    this.thumbnail.set('');
    this.videoUrl.set('');
    this.language.set('');
    this.selectedGenres.set([]);
    this.isTrending.set(false);
    this.isNew.set(false);
    this.topTen.set(false);
    this.errors.set({});
    this.thumbError.set(false);
  }

  deleteMovie(id: number, title: string): void {
    this.store.deleteMovie(id);
    this.toast.warning(`"${title}" removed.`);
  }

  onThumbError(): void { this.thumbError.set(true); }
  onThumbLoad():  void { this.thumbError.set(false); }
}
