import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TokenService } from './token.service';
import { ToastrService } from 'ngx-toastr';

export interface LoginRequest  { email: string; password: string; }
export interface RegisterRequest {
  name: string; email: string; password: string; role?: string;
}
export interface CurrentUser {
  userId: number; userName: string; email: string; role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'https://localhost:7021/api';
  private http     = inject(HttpClient);
  private router   = inject(Router);
  private tokenSvc = inject(TokenService);
  private toastr   = inject(ToastrService);

  isLoading   = signal(false);
  error       = signal<string | null>(null);
  currentUser = signal<CurrentUser | null>(null);

  constructor() {
    if (this.tokenSvc.isValid()) {
      this.currentUser.set({
        userId:   this.tokenSvc.getUserId(),
        userName: this.tokenSvc.getName(),
        email:    this.tokenSvc.getEmail(),
        role:     this.tokenSvc.getRole()
      });
    }
  }

  get isLoggedIn(): boolean { return this.tokenSvc.isValid(); }
  getToken(): string | null { return this.tokenSvc.get(); }

  /** Direct logout — no modal */
  logout(): void {
    this.tokenSvc.remove();
    this.currentUser.set(null);
    this.error.set(null);
    this.isLoading.set(false);
    this.toastr.success(
      'You have been successfully logged out.',
      'Goodbye!',
      { timeOut: 3000, positionClass: 'toast-top-center', progressBar: true }
    );
    this.router.navigate(['/login']);
  }

  login(req: LoginRequest): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.post<any>(`${this.API}/User/login`, req).subscribe({
      next: (res) => {
        this.tokenSvc.save(res.token ?? res.Token);
        this.currentUser.set({
          userId:   this.tokenSvc.getUserId(),
          userName: res.name  ?? res.Name  ?? this.tokenSvc.getName(),
          email:    res.email ?? res.Email ?? req.email,
          role:     res.role  ?? res.Role  ?? this.tokenSvc.getRole()
        });
        this.isLoading.set(false);
        this.error.set(null);

        this.toastr.success(
          `Welcome back, ${this.currentUser()?.userName}!`,
          'Logged In',
          { timeOut: 2500, positionClass: 'toast-top-center' }
        );

        const role = (this.currentUser()?.role ?? '').toLowerCase();
        if (role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else if (role === 'contentmanager') {
          this.router.navigate(['/cm/dashboard']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(
          err?.error?.message ?? err?.error?.Message ??
          'Invalid email or password.'
        );
      }
    });
  }

  register(req: RegisterRequest): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.post<any>(`${this.API}/User/register`, req).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toastr.success(
          'Account created! Please sign in.', 'Welcome to MovieBox'
        );
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(
          err?.error?.message ?? err?.error?.Message ??
          'Registration failed. Please try again.'
        );
      }
    });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http
      .post<any>(`${this.API}/User/forgot-password`, { email })
      .pipe(catchError(err => throwError(() => err)));
  }
}