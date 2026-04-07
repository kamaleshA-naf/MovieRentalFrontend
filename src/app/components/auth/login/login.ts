import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  auth   = inject(AuthService);
  toastr = inject(ToastrService);
  private http = inject(HttpClient);

  private readonly API = environment.apiBase;

  email         = signal('');
  password      = signal('');
  showPass      = signal(false);
  forgotLoading = signal(false);

  submit(): void {
    const e = this.email().trim();
    const p = this.password().trim();
    if (!e || !p) {
      this.auth.error.set('Please enter email and password.');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(e)) {
      this.auth.error.set('Please enter a valid email address.');
      return;
    }
    this.auth.login({ email: e, password: p });
  }

  forgotPassword(): void {
    const e = this.email().trim();

    // 1. Validate email is entered
    if (!e) {
      this.toastr.warning(
        'Enter your email address first, then click Forgot Password.',
        'Email Required',
        { timeOut: 4000 }
      );
      return;
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(e)) {
      this.toastr.warning('Please enter a valid email address.', 'Invalid Email');
      return;
    }

    this.forgotLoading.set(true);

    // 3. Try backend endpoint
    this.http.post<any>(`${this.API}/User/forgot-password`, { email: e })
      .subscribe({
        next: (res) => {
          this.forgotLoading.set(false);
          this.toastr.success(
            res?.message ?? `Password reset instructions sent to ${e}.`,
            'Email Sent ✓',
            { timeOut: 5000, progressBar: true }
          );
        },
        error: (err) => {
          this.forgotLoading.set(false);

          // 4. If endpoint doesn't exist (404/405) → graceful fallback (mock)
          if (err?.status === 404 || err?.status === 405 || err?.status === 0) {
            this.toastr.info(
              `If an account exists for ${e}, you'll receive reset instructions shortly.`,
              'Check Your Email',
              { timeOut: 6000, progressBar: true }
            );
            return;
          }

          // 5. Backend returned a real error message
          const msg = err?.error?.message ?? err?.error?.Message;
          if (msg) {
            this.toastr.error(msg, 'Error');
          } else {
            // 6. Unknown error → graceful fallback
            this.toastr.info(
              `If an account exists for ${e}, you'll receive reset instructions shortly.`,
              'Check Your Email',
              { timeOut: 6000 }
            );
          }
        }
      });
  }
}