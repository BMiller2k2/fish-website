import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Fish, FishInput } from '../models/fish';
import { AdminService } from './admin.service';

@Injectable({ providedIn: 'root' })
export class FishService {
  private http = inject(HttpClient);
  private admin = inject(AdminService);

  list(): Observable<Fish[]> {
    // The GitHub Pages build has no backend — read the bundled snapshot instead.
    if (environment.staticDemo) {
      return this.http.get<Fish[]>('fish-data.json');
    }
    return this.http.get<Fish[]>('/api/fish');
  }

  create(input: FishInput): Observable<Fish> {
    return this.http.post<Fish>('/api/fish', input, { headers: this.authHeaders() });
  }

  update(id: string, input: FishInput): Observable<Fish> {
    return this.http.put<Fish>(`/api/fish/${encodeURIComponent(id)}`, input, {
      headers: this.authHeaders(),
    });
  }

  remove(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`/api/fish/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  private authHeaders(): HttpHeaders {
    const token = this.admin.token();
    return token ? new HttpHeaders({ 'X-Admin-Token': token }) : new HttpHeaders();
  }
}
