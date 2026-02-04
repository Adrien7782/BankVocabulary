import { Injectable, effect, signal } from '@angular/core';
import { environment } from '../environments/environment';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private app: FirebaseApp;
  private auth;

  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly verifying = signal(false);

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    setPersistence(this.auth, browserLocalPersistence);

    onAuthStateChanged(this.auth, (u: User | null) => {
      this.user.set(u);
      this.loading.set(false);
    });

    effect(() => {
      this.error(); // reset logic hook if needed
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    this.error.set(null);
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async sendVerification(): Promise<void> {
    const u = this.auth.currentUser;
    if (!u) return;
    this.verifying.set(true);
    try {
      await sendEmailVerification(u);
    } finally {
      this.verifying.set(false);
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
