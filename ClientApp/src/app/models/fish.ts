export interface Fish {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  diet: string;
  size: string;
  imageUrl: string;
  description: string;
  facts: string[];
}

// The admin form sends a partial: only the fields being changed, plus name/id
// on create. `facts` is always sent as a string array.
export type FishInput = Partial<Omit<Fish, 'facts'>> & { facts?: string[] };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
