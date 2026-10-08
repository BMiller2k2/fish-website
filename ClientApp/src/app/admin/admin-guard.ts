import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminService } from '../services/admin.service';

// Allow /admin only when the server doesn't require a token, or one is stored.
// Otherwise send the visitor to the sign-in page.
export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);

  // No backend on the GitHub Pages build - there's nothing to manage there.
  if (environment.staticDemo) return router.createUrlTree(['/']);

  const admin = inject(AdminService);
  try {
    const { tokenRequired } = await admin.config();
    if (!tokenRequired || admin.token()) return true;
  } catch {
    /* if the config check fails, fall through to the login page */
  }
  return router.createUrlTree(['/login']);
};
