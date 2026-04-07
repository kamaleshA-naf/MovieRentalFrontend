export interface RentalResponse {
  id:           number;
  userId:       number;
  userName:     string;
  movieId:      number;
  movieTitle:   string;
  rentalDate:   string;
  expiryDate:   string;
  status:       string;
  rentalPrice?: number;
  canReturn?:   boolean;
  refundAmount?: number;
}

export interface RentalCreateRequest {
  userId:       number;
  movieId:      number;
  durationDays: number;
}