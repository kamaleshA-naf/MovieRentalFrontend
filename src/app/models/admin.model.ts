export interface DashboardStats {
  totalUsers:    number;
  totalMovies:   number;
  totalRentals:  number;
  activeRentals: number;
  totalRevenue:  number;
  totalPayments: number;
}

export interface PaymentDetail {
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

export interface PaymentSummary {
  totalRevenue:  number;
  totalPayments: number;
  payments:      PaymentDetail[];
}

export interface UserRentalSummary {
  userId:       number;
  userName:     string;
  email:        string;
  role:         string;
  totalRentals: number;
  rentals:      any[];
}