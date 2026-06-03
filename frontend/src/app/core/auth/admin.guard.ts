import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Allows access only to Administrador or SuperAdministrador users (es_admin = true).
 * Unauthenticated users are redirected to /login.
 * Authenticated non-admin users are redirected to /home.
 */
export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (!auth.esAdmin()) {
    router.navigate(['/home']);
    return false;
  }

  return true;
};
