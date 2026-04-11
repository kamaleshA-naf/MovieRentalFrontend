import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Prevents logged-in users from accessing login/register pages. */
export const noAuthGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) {
    const role = (auth.currentUser()?.role ?? '').toLowerCase();
    const dest = role === 'admin' ? '/admin/dashboard' : '/home';
    router.navigate([dest], { replaceUrl: true });
    return false;
  }

  return true;
};
