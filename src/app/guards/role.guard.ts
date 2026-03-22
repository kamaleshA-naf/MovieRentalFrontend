import { inject }             from '@angular/core';
import { CanActivateFn }      from '@angular/router';
import { Router }             from '@angular/router';
import { AuthService }        from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn) {
    router.navigate(['/login']);
    return false;
  }

  const allowedRoles: string[] = route.data?.['roles'] ?? [];
  if (allowedRoles.length === 0) {
    return true;
  }

  const userRole = auth.currentUser()?.role ?? '';

  const hasRole = allowedRoles.some(
    (r: string) => r.toLowerCase() === userRole.toLowerCase()
  );

  if (!hasRole) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};