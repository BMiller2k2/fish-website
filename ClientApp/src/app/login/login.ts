import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  token = '';
  readonly tokenRequired = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);

  ngOnInit(): void {
    // No backend on the GitHub Pages build - there's nothing to sign in to.
    if (environment.staticDemo) {
      this.router.navigateByUrl('/');
      return;
    }

    this.token = this.admin.token();
    this.admin
      .config()
      .then((c) => this.tokenRequired.set(c.tokenRequired))
      .catch(() => this.tokenRequired.set(true));
  }

  async submit(): Promise<void> {
    this.error.set('');

    if (!this.tokenRequired()) {
      this.admin.setToken('');
      this.router.navigateByUrl('/admin');
      return;
    }

    this.busy.set(true);
    const token = this.token.trim();
    const ok = await this.admin.login(token);
    if (ok) {
      this.admin.setToken(token);
      this.router.navigateByUrl('/admin');
    } else {
      this.error.set("That admin token isn't right.");
      this.busy.set(false);
    }
  }
}
