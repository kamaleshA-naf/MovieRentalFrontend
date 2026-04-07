import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Prevents logged-in users from accessing login/register pages. */
export const noAuthGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) {
    const role = (auth.currentUser()?.role ?? '').toLowerCase();
    if      (role === 'admin')          router.navigate(['/admin/dashboard'], { replaceUrl: true });
    else if (role === 'contentmanager') router.navigate(['/cm/dashboard'],    { replaceUrl: true });
    else                                router.navigate(['/home'],            { replaceUrl: true });
    return false;
  }

  return true;
};
