import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const TOKEN_KEY = 'fishAdminToken';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  // Current stored admin token (per-browser, survives reloads).
  readonly token = signal<string>(readToken());

  setToken(value: string): void {
    this.token.set(value);
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode / storage disabled — keep the in-memory value */
    }
  }

  clearToken(): void {
    this.setToken('');
  }

  /** Whether this server requires a token at all. */
  config(): Promise<{ tokenRequired: boolean }> {
    return firstValueFrom(
      this.http.get<{ tokenRequired: boolean }>('/api/admin/config'),
    );
  }

  /** Validate a token against the server. Resolves true on success. */
  async login(token: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post('/api/admin/login', { token }));
      return true;
    } catch {
      return false;
    }
  }
}

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}
