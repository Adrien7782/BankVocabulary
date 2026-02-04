import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
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
    expect(compiled.querySelector('h1')?.textContent).toContain('Flashcards');
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
