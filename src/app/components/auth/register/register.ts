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

  checkStrength(pw: string): void {
    this.password.set(pw);
    let score = 0;
    if (pw.length >= 8)          { score++; }
    if (/[A-Z]/.test(pw))        { score++; }
    if (/[0-9]/.test(pw))        { score++; }
    if (/[^a-zA-Z0-9]/.test(pw)) { score++; }

    if (pw.length === 0)     { this.strength.set(0); }
    else if (score <= 1)     { this.strength.set(1); }
    else if (score === 2)    { this.strength.set(1); }
    else if (score === 3)    { this.strength.set(2); }
    else                     { this.strength.set(3); }
  }

  strengthPct(): number {
    const s = this.strength();
    if (s === 0) { return 0;   }
    if (s === 1) { return 33;  }
    if (s === 2) { return 66;  }
    return 100;
  }

  strengthColor(): string {
    const s = this.strength();
    if (s === 0) { return 'transparent'; }
    if (s === 1) { return '#ff375f';     }
    if (s === 2) { return '#ffd60a';     }
    return '#30d158';
  }

  strengthLabel(): string {
    const s = this.strength();
    if (s === 0) { return '';       }
    if (s === 1) { return 'Weak';   }
    if (s === 2) { return 'Medium'; }
    return 'Strong';
  }

  strengthClass(): string {
    const s = this.strength();
    if (s === 1) { return 'weak';   }
    if (s === 2) { return 'medium'; }
    if (s === 3) { return 'strong'; }
    return '';
  }

  submit(): void {
    const n = this.name().trim();
    const e = this.email().trim();
    const p = this.password().trim();

    if (!n || !e || !p) {
      this.auth.error.set('All fields are required.');
      return;
    }

    if (p.length < 6) {
      this.auth.error.set(
        'Password must be at least 6 characters.'
      );
      return;
    }

    this.auth.register({
      name:     n,
      email:    e,
      password: p,
      role:     'Customer'
    });
  }
}