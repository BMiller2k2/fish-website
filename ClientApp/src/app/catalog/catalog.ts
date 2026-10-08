import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { environment } from '../../environments/environment';
import { FishService } from '../services/fish.service';
import { Fish } from '../models/fish';
import { ChatWidget } from '../chat-widget/chat-widget';

@Component({
  selector: 'app-catalog',
  imports: [ChatWidget],
  templateUrl: './catalog.html',
})
export class Catalog implements OnInit {
  private fishService = inject(FishService);

  // No backend on the GitHub Pages build, so there's nothing for the chat
  // widget to call — hide it there instead of shipping a feature that errors.
  readonly chatEnabled = !environment.staticDemo;

  readonly all = signal<Fish[]>([]);
  readonly search = signal('');
  readonly selected = signal<Fish | null>(null);
  readonly broken = signal<ReadonlySet<string>>(new Set());

  private dialog = viewChild<ElementRef<HTMLDialogElement>>('detail');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.all();
    if (!q) return list;
    return list.filter((f) =>
      [f.name, f.scientificName, f.habitat, f.diet, f.description]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  });

  ngOnInit(): void {
    this.fishService.list().subscribe((fish) => this.all.set(fish));
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  markBroken(id: string): void {
    this.broken.update((s) => new Set(s).add(id));
  }

  open(fish: Fish): void {
    this.selected.set(fish);
    this.dialog()?.nativeElement.showModal();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
    this.selected.set(null);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.close();
  }

  detailRows(f: Fish): { label: string; value: string }[] {
    return [
      { label: 'Scientific name', value: f.scientificName },
      { label: 'Habitat', value: f.habitat },
      { label: 'Diet', value: f.diet },
      { label: 'Size', value: f.size },
    ].filter((r) => r.value);
  }
}
