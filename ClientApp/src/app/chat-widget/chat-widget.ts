import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';
import { ChatMessage } from '../models/fish';

interface Bubble {
  role: 'user' | 'bot' | 'error';
  text: string;
}

const GREETING =
  "Hi! I'm the fish guide. Ask me about any fish in the catalog — " +
  'habitat, diet, fun facts, or how two fish compare.';

@Component({
  selector: 'app-chat-widget',
  imports: [FormsModule],
  templateUrl: './chat-widget.html',
})
export class ChatWidget implements OnInit {
  private chat = inject(ChatService);

  // Starts as a collapsed bar docked bottom-right (see the template).
  readonly visible = signal(true);
  readonly collapsed = signal(true);
  readonly attention = signal(false);

  readonly bubbles = signal<Bubble[]>([]);
  readonly pending = signal(false);
  text = '';

  private history: ChatMessage[] = [];
  private greeted = false;

  private logEl = viewChild<ElementRef<HTMLDivElement>>('log');
  private inputEl = viewChild<ElementRef<HTMLInputElement>>('input');

  ngOnInit(): void {
    // A moment after load, flash the collapsed bar so visitors notice it.
    setTimeout(() => {
      if (this.visible() && this.collapsed()) this.attention.set(true);
    }, 700);
  }

  openFromPill(): void {
    this.visible.set(true);
    this.expand();
  }

  close(): void {
    this.visible.set(false);
  }

  onHeaderClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.chat-close-btn')) return;
    if (this.collapsed()) this.expand();
    else this.collapsed.set(true);
  }

  clearAttention(): void {
    this.attention.set(false);
  }

  async send(): Promise<void> {
    const question = this.text.trim();
    if (!question || this.pending()) return;

    this.push('user', question);
    this.history.push({ role: 'user', content: question });
    this.text = '';
    this.pending.set(true);

    this.push('bot', '…');
    const thinkingIndex = this.bubbles().length - 1;

    try {
      const reply = await this.chat.ask(this.history);
      this.replace(thinkingIndex, { role: 'bot', text: reply });
      this.history.push({ role: 'assistant', content: reply });
    } catch (err) {
      this.replace(thinkingIndex, { role: 'error', text: '⚠ ' + (err as Error).message });
      this.history.pop(); // drop the unanswered question so history stays valid
    } finally {
      this.pending.set(false);
      this.focusInput();
    }
  }

  private expand(): void {
    this.collapsed.set(false);
    this.attention.set(false);
    this.greet();
    this.focusInput();
  }

  private greet(): void {
    if (this.greeted) return;
    this.greeted = true;
    this.push('bot', GREETING);
  }

  private push(role: Bubble['role'], text: string): void {
    this.bubbles.update((b) => [...b, { role, text }]);
    this.scrollToEnd();
  }

  private replace(index: number, bubble: Bubble): void {
    this.bubbles.update((b) => b.map((x, i) => (i === index ? bubble : x)));
    this.scrollToEnd();
  }

  private scrollToEnd(): void {
    setTimeout(() => {
      const el = this.logEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  private focusInput(): void {
    setTimeout(() => this.inputEl()?.nativeElement.focus());
  }
}
