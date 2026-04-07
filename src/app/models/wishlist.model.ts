export interface WishlistResponse {
  id:          number;
  userId:      number;
  movieId:     number;
  movieTitle:  string;
  rentalPrice: number;
  addedDate:   string;
}

export interface WishlistCreateRequest {
  userId:  number;
  movieId: number;
}