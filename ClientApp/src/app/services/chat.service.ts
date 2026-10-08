import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChatMessage } from '../models/fish';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  async ask(messages: ChatMessage[]): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ reply: string }>('/api/chat', { messages }),
      );
      return res.reply;
    } catch (err: unknown) {
      const body = (err as { error?: { error?: string } })?.error;
      throw new Error(body?.error ?? 'Request failed');
    }
  }
}
