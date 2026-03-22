export interface RentalResponse {
  id:          number;
  userId:      number;
  userName:    string;
  movieId:     number;
  movieTitle:  string;
  rentalDate:  string;  // ← required for progressWidth()
  expiryDate:  string;
  status:      string;
}

export interface RentalCreateRequest {
  userId:       number;
  movieId:      number;
  durationDays: number;
}