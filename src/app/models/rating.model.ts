export interface MovieRatingCreate {
  userId:      number;
  ratingValue: number;
}

export interface MovieRatingResponse {
  id:          number;
  movieId:     number;
  movieTitle:  string;
  userId:      number;
  userName:    string;
  ratingValue: number;
  ratingLabel: string;
  ratedAt:     string;
  isRemoved:   boolean;
}

export interface MovieRatingSummary {
  movieId:       number;
  movieTitle:    string;
  averageRating: number;
  totalRatings:  number;
  notForMeCount: number;
  likeCount:     number;
  loveCount:     number;
}

export interface UserGenrePreference {
  userId:           number;
  userName:         string;
  genrePreferences: GenreRating[];
}

export interface GenreRating {
  genreName:     string;
  averageRating: number;
  totalRatings:  number;
}