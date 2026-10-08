import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FishService } from '../services/fish.service';
import { AdminService } from '../services/admin.service';
import { Fish, FishInput } from '../models/fish';

interface FormModel {
  name: string;
  scientificName: string;
  size: string;
  imageUrl: string;
  habitat: string;
  diet: string;
  description: string;
  facts: string;
}

const EMPTY: FormModel = {
  name: '',
  scientificName: '',
  size: '',
  imageUrl: '',
  habitat: '',
  diet: '',
  description: '',
  facts: '',
};

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  private fishService = inject(FishService);
  private admin = inject(AdminService);
  private router = inject(Router);

  readonly fish = signal<Fish[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly notice = signal<{ text: string; ok: boolean } | null>(null);

  form: FormModel = { ...EMPTY };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.fishService.list().subscribe((fish) => this.fish.set(fish));
  }

  save(): void {
    const payload: FishInput = {
      name: this.form.name,
      scientificName: this.form.scientificName,
      size: this.form.size,
      imageUrl: this.form.imageUrl,
      habitat: this.form.habitat,
      diet: this.form.diet,
      description: this.form.description,
      facts: this.form.facts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const id = this.editingId();
    const request = id
      ? this.fishService.update(id, payload)
      : this.fishService.create(payload);

    request.subscribe({
      next: () => {
        this.notify(id ? 'Fish updated.' : 'Fish added.', true);
        this.resetForm();
        this.load();
      },
      error: (err) => this.handleError(err, 'Save failed'),
    });
  }

  edit(f: Fish): void {
    this.editingId.set(f.id);
    this.form = {
      name: f.name,
      scientificName: f.scientificName,
      size: f.size,
      imageUrl: f.imageUrl,
      habitat: f.habitat,
      diet: f.diet,
      description: f.description,
      facts: f.facts.join('\n'),
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY };
  }

  remove(f: Fish): void {
    if (!confirm(`Delete "${f.name}"?`)) return;
    this.fishService.remove(f.id).subscribe({
      next: () => {
        this.notify('Fish deleted.', true);
        this.load();
      },
      error: (err) => this.handleError(err, 'Delete failed'),
    });
  }

  signOut(): void {
    this.admin.clearToken();
    this.router.navigateByUrl('/login');
  }

  private notify(text: string, ok: boolean): void {
    this.notice.set({ text, ok });
    if (ok) setTimeout(() => this.notice.set(null), 3000);
  }

  private handleError(err: unknown, fallback: string): void {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.router.navigateByUrl('/login');
      return;
    }
    const message =
      err instanceof HttpErrorResponse ? (err.error?.error ?? fallback) : fallback;
    this.notify(message, false);
  }
}
