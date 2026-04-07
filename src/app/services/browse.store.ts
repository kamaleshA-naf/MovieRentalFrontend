import { Injectable, signal, computed } from '@angular/core';
import { BrowseMovie, SEED_LANGUAGES, SEED_GENRES, SOUTH_INDIAN_LANGS } from '../models/browse.model';

export const PLACEHOLDER = 'https://placehold.co/300x450/1a1a1a/555?text=No+Image';

// ── Storage keys ───────────────────────────────────────────────────────────────
const KEYS = {
  movies:    'bx_movies_v3',
  languages: 'bx_languages_v3',
  genres:    'bx_genres_v3',
  myList:    'bx_mylist_v3',
} as const;

// ── Seed movies ────────────────────────────────────────────────────────────────
const SEED_MOVIES: BrowseMovie[] = [
  { id:1,  title:'Vikram',                   description:'A special agent hunts a masked killer.',         director:'Lokesh Kanagaraj',  releaseYear:2022, pricePerDay:49, thumbnail:'', videoUrl:'', language:'Tamil',     genres:['Action','Thriller'], isTrending:true,  isNew:false, topTen:true  },
  { id:2,  title:'Jailer',                   description:'A retired jailer takes on a drug lord.',         director:'Nelson',            releaseYear:2023, pricePerDay:49, thumbnail:'', videoUrl:'', language:'Tamil',     genres:['Action','Comedy'],   isTrending:true,  isNew:true,  topTen:true  },
  { id:3,  title:'Baahubali',                description:'An epic tale of power and betrayal.',            director:'S.S. Rajamouli',    releaseYear:2015, pricePerDay:29, thumbnail:'', videoUrl:'', language:'Telugu',    genres:['Action','Drama'],    isTrending:true,  isNew:false, topTen:true  },
  { id:4,  title:'RRR',                      description:'Two legendary freedom fighters join forces.',    director:'S.S. Rajamouli',    releaseYear:2022, pricePerDay:49, thumbnail:'', videoUrl:'', language:'Telugu',    genres:['Action','Drama'],    isTrending:true,  isNew:false, topTen:true  },
  { id:5,  title:'Stree 2',                  description:'The town faces a new supernatural threat.',      director:'Amar Kaushik',      releaseYear:2024, pricePerDay:49, thumbnail:'', videoUrl:'', language:'Hindi',     genres:['Comedy','Horror'],   isTrending:true,  isNew:true,  topTen:true  },
  { id:6,  title:'Queen',                    description:'A woman discovers herself on a solo honeymoon.', director:'Vikas Bahl',        releaseYear:2014, pricePerDay:29, thumbnail:'', videoUrl:'', language:'Hindi',     genres:['Drama','Romance'],   isTrending:false, isNew:false, topTen:false },
  { id:7,  title:'Manjummel Boys',           description:'Friends trapped in a deadly cave.',              director:'Chidambaram',       releaseYear:2024, pricePerDay:39, thumbnail:'', videoUrl:'', language:'Malayalam', genres:['Thriller','Drama'],  isTrending:true,  isNew:true,  topTen:true  },
  { id:8,  title:'Kalki 2898 AD',            description:'A futuristic mythological epic.',                director:'Nag Ashwin',        releaseYear:2024, pricePerDay:59, thumbnail:'', videoUrl:'', language:'Telugu',    genres:['Action','Sci-Fi'],   isTrending:true,  isNew:true,  topTen:true  },
  { id:9,  title:'Oppenheimer',              description:'The story of the atomic bomb creator.',          director:'Christopher Nolan', releaseYear:2023, pricePerDay:59, thumbnail:'', videoUrl:'', language:'English',   genres:['Drama','Thriller'],  isTrending:true,  isNew:false, topTen:true  },
  { id:10, title:'Zindagi Na Milegi Dobara', description:'Three friends on a road trip.',                  director:'Zoya Akhtar',       releaseYear:2011, pricePerDay:29, thumbnail:'', videoUrl:'', language:'Hindi',     genres:['Drama','Romance'],   isTrending:false, isNew:false, topTen:false },
];

// ── Persistence helpers ────────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Store ──────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class BrowseStore {
  readonly placeholder = PLACEHOLDER;

  // ── Primary state signals ──────────────────────────────────────
  readonly movies    = signal<BrowseMovie[]>(load(KEYS.movies,    SEED_MOVIES));
  readonly languages = signal<string[]>(     load(KEYS.languages, SEED_LANGUAGES));
  readonly genres    = signal<string[]>(     load(KEYS.genres,    SEED_GENRES));
  readonly myList    = signal<number[]>(     load(KEYS.myList,    []));

  // ── Computed: filtered/grouped views ──────────────────────────

  readonly trending = computed(() => this.movies().filter(m => m.isTrending));

  readonly topTen = computed(() => this.movies().filter(m => m.topTen).slice(0, 10));

  readonly southIndian = computed(() =>
    this.movies().filter(m => (SOUTH_INDIAN_LANGS as readonly string[]).includes(m.language))
  );

  readonly myListMovies = computed(() =>
    this.movies().filter(m => this.myList().includes(m.id))
  );

  /**
   * Only languages that exist in the languages[] list AND have at least one movie.
   * Preserves the order from languages[].
   * Home page uses this to render language rows.
   */
  readonly activeLanguages = computed<string[]>(() => {
    const withMovies = new Set(this.movies().map(m => m.language));
    return this.languages().filter(l => withMovies.has(l));
  });

  /**
   * Only genres that exist in genres[] AND have at least one movie.
   */
  readonly activeGenres = computed<string[]>(() => {
    const withMovies = new Set(this.movies().flatMap(m => m.genres));
    return this.genres().filter(g => withMovies.has(g));
  });

  /** Movies grouped by language — reactive Map. */
  readonly moviesByLanguage = computed<Map<string, BrowseMovie[]>>(() => {
    const map = new Map<string, BrowseMovie[]>();
    for (const m of this.movies()) {
      const bucket = map.get(m.language) ?? [];
      map.set(m.language, [...bucket, m]);
    }
    return map;
  });

  /** Movies grouped by genre — reactive Map. */
  readonly moviesByGenre = computed<Map<string, BrowseMovie[]>>(() => {
    const map = new Map<string, BrowseMovie[]>();
    for (const m of this.movies()) {
      for (const g of m.genres) {
        const bucket = map.get(g) ?? [];
        map.set(g, [...bucket, m]);
      }
    }
    return map;
  });

  // ── Lookup helpers ─────────────────────────────────────────────

  moviesForLanguage(lang: string): BrowseMovie[] {
    return this.moviesByLanguage().get(lang) ?? [];
  }

  moviesForGenre(genre: string): BrowseMovie[] {
    return this.moviesByGenre().get(genre) ?? [];
  }

  byLetter(letter: string): BrowseMovie[] {
    if (!letter) return [];
    return this.movies().filter(m =>
      m.title.toUpperCase().startsWith(letter.toUpperCase())
    );
  }

  // ── Language mutations ─────────────────────────────────────────

  /**
   * Add a language. Returns error string or null on success.
   * Caller is responsible for showing the toast.
   */
  addLanguage(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Enter a language name.';
    const exists = this.languages().some(
      l => l.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return `"${trimmed}" already exists.`;
    const next = [...this.languages(), trimmed];
    this.languages.set(next);
    save(KEYS.languages, next);
    return null;
  }

  removeLanguage(name: string): void {
    const next = this.languages().filter(l => l !== name);
    this.languages.set(next);
    save(KEYS.languages, next);
  }

  // ── Genre mutations ────────────────────────────────────────────

  addGenre(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Enter a genre name.';
    const exists = this.genres().some(
      g => g.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return `"${trimmed}" already exists.`;
    const next = [...this.genres(), trimmed];
    this.genres.set(next);
    save(KEYS.genres, next);
    return null;
  }

  removeGenre(name: string): void {
    const next = this.genres().filter(g => g !== name);
    this.genres.set(next);
    save(KEYS.genres, next);
  }

  // ── Movie mutations ────────────────────────────────────────────

  addMovie(movie: Omit<BrowseMovie, 'id'>): void {
    const next = [...this.movies(), { ...movie, id: Date.now() }];
    this.movies.set(next);
    save(KEYS.movies, next);
  }

  deleteMovie(id: number): void {
    const next = this.movies().filter(m => m.id !== id);
    this.movies.set(next);
    save(KEYS.movies, next);
  }

  // ── My List ────────────────────────────────────────────────────

  toggleMyList(id: number): void {
    const cur = this.myList();
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    this.myList.set(next);
    save(KEYS.myList, next);
  }

  isInMyList(id: number): boolean {
    return this.myList().includes(id);
  }
}
