import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

// Allow /admin only when the server doesn't require a token, or one is stored.
// Otherwise send the visitor to the sign-in page.
export const adminGuard: CanActivateFn = async () => {
  const admin = inject(AdminService);
  const router = inject(Router);

  try {
    const { tokenRequired } = await admin.config();
    if (!tokenRequired || admin.token()) return true;
  } catch {
    /* if the config check fails, fall through to the login page */
  }
  return router.createUrlTree(['/login']);
};
