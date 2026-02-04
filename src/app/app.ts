import { Component, signal, computed, effect, ViewChildren, ElementRef, QueryList, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { environment } from '../environments/environment';
import { getApp, initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  Firestore,
} from 'firebase/firestore';

type Flashcard = {
  id: string;
  front: string;
  back: string;
  flipped: boolean;
  createdAt: number;
};

type TestResult = {
  id: number;
  createdAt: number;
  size: number;
  score: number;
  cards: Flashcard[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly historyKeyBase = 'bank-vocabulary/history';
  private nextTestId = 1;
  private db: Firestore | null = null;
  private unsubscribeCards?: () => void;
  private currentUserId: string | null = null;

  readonly flashcards = signal<Flashcard[]>([]);

  readonly totalCards = computed(() => this.flashcards().length);
  readonly activeTab = signal<'home' | 'bank' | 'review'>('home');

  // Revision state
  readonly testSize = signal(5);
  readonly reviewCards = signal<Flashcard[]>([]);
  readonly currentIndex = signal(0);
  readonly score = signal(0);
  readonly showFront = signal(true);
  readonly cardRevealed = signal(false);
  readonly lastCorrect = signal<boolean | null>(null);
  readonly testFinished = signal(false);
  readonly answer = signal('');
  readonly history = signal<TestResult[]>([]);
  readonly selectedHistory = signal<TestResult | null>(null);
  readonly deleteMode = signal(false);
  readonly lastAddedId = signal<string | null>(null);
  readonly shuffleWave = signal(false);
  readonly email = signal('');
  readonly password = signal('');
  readonly authError = signal<string | null>(null);
  readonly environment = environment;
  readonly historyKey = signal<string>(`${this.historyKeyBase}/anon`);

  @ViewChildren('cardEl') cardRefs?: QueryList<ElementRef<HTMLElement>>;
  readonly auth = inject(AuthService);

  form = {
    front: '',
    back: '',
  };

  constructor() {
    this.loadHistory();

    effect(() => {
      const data = JSON.stringify(this.history());
      localStorage.setItem(this.historyKey(), data);
    });

    effect(() => {
      const user = this.auth.user();
      this.handleUserChange(user ?? null);
    });
  }

  // Authentication
  readonly isAuthenticated = computed(() => {
    const user = this.auth.user();
    if (!user) return false;
    if (environment.requireEmailVerification && !user.emailVerified) return false;
    return true;
  });

  readonly avatarInitial = computed(() => {
    const mail = this.auth.user()?.email ?? '';
    return mail ? mail.trim()[0]?.toUpperCase() ?? '?' : '?';
  });

  readonly avatarColor = computed(() => {
    const mail = this.auth.user()?.email ?? '';
    const colors = ['#22d3ee', '#60a5fa', '#f97316', '#f43f5e', '#c084fc', '#34d399'];
    if (!mail) return colors[0];
    let hash = 0;
    for (const ch of mail) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
    return colors[hash % colors.length];
  });

  async login(): Promise<void> {
    this.authError.set(null);
    try {
      await this.auth.signIn(this.email(), this.password());
      this.password.set('');
    } catch (e: any) {
      this.authError.set(e?.message ?? 'Erreur de connexion');
    }
  }

  async sendVerification(): Promise<void> {
    try {
      await this.auth.sendVerification();
    } catch (e: any) {
      this.authError.set(e?.message ?? 'Échec de l’envoi du mail');
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  // Data actions
  addCard(): void {
    const front = this.form.front.trim();
    const back = this.form.back.trim();
    if (!front || !back) return;
    if (!this.db || !this.auth.user()) return;

    addDoc(collection(this.db, 'users', this.auth.user()!.uid, 'cards'), {
      front,
      back,
      flipped: false,
      createdAt: Date.now(),
    })
      .then((ref) => {
        this.lastAddedId.set(ref.id);
        setTimeout(() => this.lastAddedId.set(null), 800);
      })
      .catch((e) => this.authError.set(e?.message ?? 'Erreur lors de l’ajout'));

    this.form.front = '';
    this.form.back = '';
  }

  toggleCard(id: string): void {
    if (this.deleteMode()) return;
    if (!this.db || !this.auth.user()) return;
    const card = this.flashcards().find((c) => c.id === id);
    if (!card) return;
    updateDoc(doc(this.db, 'users', this.auth.user()!.uid, 'cards', id), {
      flipped: !card.flipped,
    }).catch(() => {});
  }

  toggleDeleteMode(): void {
    this.deleteMode.update((v) => !v);
  }

  deleteCard(id: string): void {
    if (!this.db || !this.auth.user()) return;
    deleteDoc(doc(this.db, 'users', this.auth.user()!.uid, 'cards', id)).catch(() => {});
  }

  shuffleCards(): void {
    this.flashcards.update((cards) => {
      const arr = [...cards];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });

    this.prepareShuffleVectors();

    this.shuffleWave.set(false);
    setTimeout(() => this.shuffleWave.set(true));
    setTimeout(() => this.shuffleWave.set(false), 1000);
  }

  private prepareShuffleVectors(): void {
    if (!this.cardRefs) return;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    this.cardRefs.forEach((ref) => {
      const el = ref.nativeElement;
      const rect = el.getBoundingClientRect();
      const dx = centerX - (rect.left + rect.width / 2);
      const dy = centerY - (rect.top + rect.height / 2);
      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--dy', `${dy}px`);
    });
  }

  switchTab(tab: 'home' | 'bank' | 'review'): void {
    this.activeTab.set(tab);
    if (tab !== 'review') {
      this.selectedHistory.set(null);
    }
    if (tab !== 'bank') {
      this.deleteMode.set(false);
    }
  }

  startTest(fromCards?: Flashcard[]): void {
    this.selectedHistory.set(null);
    const pool = fromCards ? [...fromCards] : [...this.flashcards()];
    if (pool.length === 0) {
      this.testFinished.set(true);
      this.reviewCards.set([]);
      return;
    }

    const size = Math.max(1, Math.min(this.testSize(), pool.length));
    const shuffled = fromCards
      ? pool.slice(0, size)
      : pool.sort(() => Math.random() - 0.5).slice(0, size);

    this.reviewCards.set(shuffled);
    this.currentIndex.set(0);
    this.score.set(0);
    this.testFinished.set(false);
    this.testSize.set(size);
    this.prepareCard();
  }

  submitAnswer(): void {
    const card = this.currentCard();
    if (!card || this.cardRevealed()) return;

    const expected = this.showFront() ? card.back : card.front;
    const user = this.answer().trim().toLowerCase();
    const isCorrect = user === expected.trim().toLowerCase();

    if (isCorrect) {
      this.score.update((s) => s + 1);
    }

    this.lastCorrect.set(isCorrect);
    this.cardRevealed.set(true);
  }

  nextCard(): void {
    const next = this.currentIndex() + 1;
    if (next >= this.reviewCards().length) {
      this.finalizeTest();
      return;
    }
    this.currentIndex.set(next);
    this.prepareCard();
  }

  openHistoryTest(test: TestResult): void {
    this.activeTab.set('review');
    this.selectedHistory.set(test);
    this.reviewCards.set(test.cards);
    this.currentIndex.set(0);
    this.score.set(test.score);
    this.testFinished.set(true);
    this.answer.set('');
    this.cardRevealed.set(false);
    this.lastCorrect.set(null);
    this.showFront.set(true);
  }

  currentCard = computed(() => this.reviewCards()[this.currentIndex()] ?? null);

  private finalizeTest(): void {
    if (this.testFinished()) return;
    this.testFinished.set(true);
    const size = this.reviewCards().length;
    if (size === 0) return;
    const savedCards = this.reviewCards().map((c) => ({ ...c, flipped: false }));
    const result: TestResult = {
      id: this.nextTestId++,
      createdAt: Date.now(),
      size,
      score: this.score(),
      cards: savedCards,
    };
    this.history.update((items) => [result, ...items].slice(0, 4));
  }

  private prepareCard(): void {
    this.showFront.set(Math.random() > 0.5);
    this.answer.set('');
    this.cardRevealed.set(false);
    this.lastCorrect.set(null);
  }

  private loadHistory(): void {
    const hist = localStorage.getItem(this.historyKey());
    if (hist) {
      try {
        const parsed = JSON.parse(hist) as TestResult[];
        if (Array.isArray(parsed)) {
          this.history.set(parsed.slice(0, 4));
          const maxId = parsed.reduce((m, t) => Math.max(m, t.id ?? 0), 0);
          this.nextTestId = (maxId || 0) + 1;
        }
      } catch {
        // ignore
      }
    }
  }

  private handleUserChange(user: any): void {
    this.unsubscribeCards?.();
    if (!user) {
      this.flashcards.set([]);
      this.db = null;
      this.historyKey.set(`${this.historyKeyBase}/anon`);
      this.history.set([]);
      this.reviewCards.set([]);
      this.selectedHistory.set(null);
      this.testFinished.set(false);
      this.currentIndex.set(0);
      this.currentUserId = null;
      return;
    }

    if (this.currentUserId && this.currentUserId !== user.uid) {
      this.history.set([]);
      this.reviewCards.set([]);
      this.selectedHistory.set(null);
      this.testFinished.set(false);
      this.currentIndex.set(0);
    }

    this.currentUserId = user.uid;
    this.historyKey.set(`${this.historyKeyBase}/${user.uid}`);
    this.loadHistory();

    if (!this.db) {
      try {
        this.db = getFirestore(getApp());
      } catch {
        this.db = getFirestore(initializeApp(environment.firebase));
      }
    }

    const q = query(collection(this.db, 'users', user.uid, 'cards'), orderBy('createdAt', 'desc'));
    this.unsubscribeCards = onSnapshot(q, (snap) => {
      const cards: Flashcard[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          front: data.front,
          back: data.back,
          flipped: !!data.flipped,
          createdAt: data.createdAt ?? Date.now(),
        };
      });
      this.flashcards.set(cards);
    });
  }
}
