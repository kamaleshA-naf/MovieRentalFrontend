import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  auth   = inject(AuthService);
  toastr = inject(ToastrService);

  name     = signal('');
  email    = signal('');
  password = signal('');
  showPass = signal(false);
  strength = signal<0 | 1 | 2 | 3>(0);

  // ── Password strength checker ──────────────────────────────────────────────
  checkStrength(pw: string): void {
    this.password.set(pw);
    if (!pw.length) { this.strength.set(0); return; }

    let score = 0;
    if (pw.length >= 8)           score++;
    if (/[A-Z]/.test(pw))         score++;
    if (/[0-9]/.test(pw))         score++;
    if (/[^a-zA-Z0-9]/.test(pw))  score++;

    if      (score <= 1) this.strength.set(1);
    else if (score === 2) this.strength.set(1);
    else if (score === 3) this.strength.set(2);
    else                  this.strength.set(3);
  }

  strengthPct(): number {
    const map: Record<number, number> = { 0: 0, 1: 33, 2: 66, 3: 100 };
    return map[this.strength()] ?? 0;
  }

  strengthColor(): string {
    const map: Record<number, string> = {
      0: 'transparent', 1: '#ff375f', 2: '#ffd60a', 3: '#30d158'
    };
    return map[this.strength()] ?? 'transparent';
  }

  strengthLabel(): string {
    const map: Record<number, string> = { 0: '', 1: 'Weak', 2: 'Medium', 3: 'Strong' };
    return map[this.strength()] ?? '';
  }

  strengthClass(): string {
    const map: Record<number, string> = { 1: 'weak', 2: 'medium', 3: 'strong' };
    return map[this.strength()] ?? '';
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  submit(): void {
    const n = this.name().trim();
    const e = this.email().trim();
    const p = this.password();   // don't trim passwords — spaces are valid

    // Client-side validation
    if (!n) { this.auth.error.set('Full name is required.');        return; }
    if (!e) { this.auth.error.set('Email address is required.');    return; }
    if (!p) { this.auth.error.set('Password is required.');         return; }
    if (p.length < 6) {
      this.auth.error.set('Password must be at least 6 characters.');
      return;
    }

    this.auth.register({
      name:     n,
      email:    e,
      password: p,
      role:     2    // UserRole.Customer — numeric value the backend enum expects
    });
  }
}