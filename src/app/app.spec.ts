import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './auth.service';

describe('App', () => {
  const authStub = {
    user: () => null,
    loading: () => false,
    verifying: () => false,
    signIn: () => Promise.resolve(),
    sendVerification: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  } as unknown as AuthService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: AuthService, useValue: authStub }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the heading', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Connexion');
  });

  it('should add a new card', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const initial = app.flashcards().length;

    app.form.front = 'fromage';
    app.form.back = 'cheese';
    app.addCard();

    expect(app.flashcards().length).toBe(initial + 1);
    expect(app.flashcards()[0].front).toBe('fromage');
    expect(app.form.front).toBe('');
    expect(app.form.back).toBe('');
  });
});
