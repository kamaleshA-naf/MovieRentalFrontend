import { GenreResponse } from './movie.model';

export interface CartResponse {
  id:           number;
  userId:       number;
  movieId:      number;
  movieTitle:   string;
  thumbnailUrl: string | null;
  rentalPrice:  number;
  durationDays: number;
  totalCost:    number;
  addedAt:      string;
  genres:       GenreResponse[];
}

export interface CartAddRequest {
  userId:       number;
  movieId:      number;
  durationDays: number;
}

export interface CartUpdateRequest {
  durationDays: number;
}

export interface CartCheckoutResult {
  totalMovies:  number;
  totalAmount:  number;
  rentals:      any[];
}