import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { TokenService } from './token.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from '@env/environment';

export interface LoginRequest  { email: string; password: string; }
export interface RegisterRequest { name: string; email: string; password: string; role?: number; }
export interface CurrentUser { userId: number; userName: string; email: string; role: string; }

/** Always send/receive plain JSON — never let Angular negotiate problem+json */
const JSON_HEADERS = new HttpHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' });

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiBase;

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

  // ── LOGOUT ──────────────────────────────────────────────────────────────────
  logout(): void {
    this.tokenSvc.remove();
    this.currentUser.set(null);
    this.error.set(null);
    this.isLoading.set(false);
    this.toastr.success('Logged out successfully.', 'Goodbye!', {
      timeOut: 3000, positionClass: 'toast-top-center', progressBar: true
    });
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  login(req: LoginRequest): void {
    this.isLoading.set(true);
    this.error.set(null);

    const body = JSON.stringify({ email: req.email.trim(), password: req.password });

    this.http
      .post<any>(`${this.API}/User/login`, body, { headers: JSON_HEADERS })
      .subscribe({
        next: (res) => {
          const token = res.token ?? res.Token;
          if (!token) {
            this.error.set('Login failed — no token received.');
            this.isLoading.set(false);
            return;
          }

          this.tokenSvc.save(token);
          // Response only contains Token — decode all user info from JWT claims
          this.currentUser.set({
            userId:   this.tokenSvc.getUserId(),
            userName: this.tokenSvc.getName(),
            email:    this.tokenSvc.getEmail(),
            role:     this.tokenSvc.getRole()
          });
          this.isLoading.set(false);

          const role = (this.currentUser()?.role ?? '').toLowerCase();
          let destination: string;
          if      (role === 'admin')          destination = '/admin/dashboard';
          else if (role === 'contentmanager') destination = '/cm/dashboard';
          else                                destination = '/home';

          this.router.navigate([destination], { replaceUrl: true }).then(() => {
            this.toastr.success(
              `Welcome back, ${this.currentUser()?.userName}!`, 'Logged In',
              { timeOut: 3000 }
            );
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('[AuthService] Login error:', err);
          this.error.set(
            err?.error?.message ?? err?.error?.Message ?? 'Invalid email or password.'
          );
        }
      });
  }

  // ── REGISTER ─────────────────────────────────────────────────────────────────
  register(req: RegisterRequest): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Build a clean payload — no undefined/null fields
    const payload: Record<string, unknown> = {
      name:     req.name.trim(),
      email:    req.email.trim(),
      password: req.password,
      role:     req.role ?? 2   // 2 = Customer enum value
    };

    this.http
      .post<any>(`${this.API}/User/register`, JSON.stringify(payload), { headers: JSON_HEADERS })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/login'], { replaceUrl: true }).then(() => {
            this.toastr.success(
              'Registration successful! Please login.',
              'Account Created',
              { timeOut: 4000, positionClass: 'toast-top-center', progressBar: true }
            );
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('[AuthService] Register error:', err);
          this.error.set(
            err?.error?.message ?? err?.error?.Message ?? 'Registration failed.'
          );
        }
      });
  }

  // ── FORGOT PASSWORD ──────────────────────────────────────────────────────────
  // forgotPassword(email: string): Observable<any> {
  //   const body = JSON.stringify({ email: email.trim() });
  //   return this.http
  //     .post<any>(`${this.API}/User/forgot-password`, body, { headers: JSON_HEADERS })
  //     .pipe(
  //       catchError(err => {
  //         console.error('[AuthService] Forgot-password error:', err);
  //         return throwError(() => err);
  //       })
  //     );
  // }
}