import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

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
    this.auth.login({ email: e, password: p });
  }

  forgotPassword(): void {
    const e = this.email().trim();
    if (!e) {
      this.toastr.warning(
        'Enter your email address first, then click Forgot Password.',
        'Email Required',
        { timeOut: 4000 }
      );
      return;
    }

    this.forgotLoading.set(true);
    this.auth.forgotPassword(e).subscribe({
      next: () => {
        this.forgotLoading.set(false);
        this.toastr.success(
          `Password reset instructions sent to ${e}.`,
          'Email Sent ✓',
          { timeOut: 5000, progressBar: true }
        );
      },
      error: (err) => {
        this.forgotLoading.set(false);
        const msg = err?.error?.message;
        // If backend endpoint doesn't exist yet → graceful fallback
        if (!msg) {
          this.toastr.info(
            `If an account exists for ${e}, reset instructions will be sent.`,
            'Check Your Email',
            { timeOut: 5000 }
          );
        } else {
          this.toastr.error(msg, 'Error');
        }
      }
    });
  }
}