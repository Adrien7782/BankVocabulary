import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Flashcard = {
  id: number;
  front: string;
  back: string;
  flipped: boolean;
  createdAt: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private nextId = 4;
  private readonly storageKey = 'bank-vocabulary/cards';

  readonly flashcards = signal<Flashcard[]>([
    { id: 1, front: 'Bonjour', back: 'Hello', flipped: false, createdAt: Date.now() },
    { id: 2, front: 'Merci', back: 'Thank you', flipped: false, createdAt: Date.now() },
    { id: 3, front: 'Banque', back: 'Bank', flipped: false, createdAt: Date.now() },
    { id: 4, front: 'Compte courant', back: 'Checking account', flipped: false, createdAt: Date.now() }
  ]);

  readonly totalCards = computed(() => this.flashcards().length);

  form = {
    front: '',
    back: ''
  };

  constructor() {
    this.loadFromStorage();

    effect(() => {
      const data = JSON.stringify(this.flashcards());
      localStorage.setItem(this.storageKey, data);
    });
  }

  addCard(): void {
    const front = this.form.front.trim();
    const back = this.form.back.trim();
    if (!front || !back) return;

    this.flashcards.update((cards) => [
      {
        id: ++this.nextId,
        front,
        back,
        flipped: false,
        createdAt: Date.now()
      },
      ...cards
    ]);

    this.form.front = '';
    this.form.back = '';
  }

  toggleCard(id: number): void {
    this.flashcards.update((cards) =>
      cards.map((card) =>
        card.id === id ? { ...card, flipped: !card.flipped } : card
      )
    );
  }

  private loadFromStorage(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Flashcard[];
      if (Array.isArray(parsed) && parsed.every((c) => c.front && c.back && typeof c.id === 'number')) {
        this.flashcards.set(parsed.map((c) => ({ ...c, flipped: false })));
        const maxId = parsed.reduce((max, c) => Math.max(max, c.id), 0);
        this.nextId = maxId || 0;
      }
    } catch {
      // ignore corrupted storage; keep defaults
    }
  }
}
