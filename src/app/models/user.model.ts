export interface User {
  userId:    number;
  userName:  string;
  userEmail: string;
  role:      string;
  isActive:  boolean;
  createdAt: string;
  token:     string;
}

// This matches what backend /api/User returns (id, name, email)
export interface UserResponse {
  id:        number;
  userId?:   number;
  name:      string;
  userName?: string;
  email:     string;
  role:      string;
  isActive:  boolean;
  createdAt: string;
  totalRentals?: number;
}

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface RegisterRequest {
  name:     string;
  email:    string;
  password: string;
  role?:    number;
}