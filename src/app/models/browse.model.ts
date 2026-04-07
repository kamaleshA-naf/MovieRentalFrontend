export interface BrowseMovie {
  id:          number;
  title:       string;
  description: string;
  director:    string;
  releaseYear: number;
  pricePerDay: number;
  thumbnail:   string;
  videoUrl:    string;   // optional — empty string means none
  language:    string;
  genres:      string[];
  isTrending:  boolean;
  isNew:       boolean;
  topTen:      boolean;
}

export const SOUTH_INDIAN_LANGS = ['Tamil', 'Telugu', 'Malayalam', 'Kannada'] as const;

// Seed languages & genres — stored independently so admin can manage them
export const SEED_LANGUAGES = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English'];
export const SEED_GENRES    = ['Action', 'Comedy', 'Romance', 'Thriller', 'Drama', 'Horror', 'Sci-Fi'];
