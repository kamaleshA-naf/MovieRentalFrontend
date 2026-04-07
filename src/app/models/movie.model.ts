export interface GenreResponse {
  id:   number;
  name: string;
}

export interface MovieResponse {
  id:           number;
  title:        string;
  description:  string;
  rentalPrice:  number;
  director:     string;
  releaseYear:  number;
  rating:       number;
  isActive:     boolean;
  videoUrl:     string | null;
  thumbnailUrl: string | null;
  viewCount:    number;
  createdAt:    string;
  genres:       GenreResponse[];
  language?:    string;   // optional — returned by backend if available
}

export interface MovieCreateRequest {
  title:        string;
  description:  string;
  rentalPrice:  number;
  director:     string;
  releaseYear:  number;
  rating:       number;
  genreIds:     number[];
  videoUrl:     string | null;
  thumbnailUrl: string | null;
  language?:    string;
}

export interface MovieUpdateRequest {
  title?:        string;
  description?:  string;
  rentalPrice?:  number;
  director?:     string;
  releaseYear?:  number;
  rating?:       number;
  videoUrl?:     string | null;
  thumbnailUrl?: string | null;
  isActive?:     boolean;
}

export interface PagedResult<T> {
  data:        T[];
  totalCount:  number;
  pageNumber:  number;
  pageSize:    number;
  totalPages:  number;
  hasNext:     boolean;
  hasPrevious: boolean;
}