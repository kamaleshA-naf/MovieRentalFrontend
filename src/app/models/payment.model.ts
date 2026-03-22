export interface PaymentResponse {
  id:         number;
  userId:     number;
  userName:   string;
  movieId:    number;
  movieTitle: string;
  rentalId:   number;
  amount:     number;
  method:     string;
  status:     string;
  paidAt:     string;
}