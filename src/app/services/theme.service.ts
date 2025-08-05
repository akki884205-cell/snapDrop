import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'default' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = new BehaviorSubject<Theme>('dark');
  public theme$ = this.currentTheme.asObservable();

  constructor() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    if (savedTheme) {
      this.setTheme(savedTheme);
    }
  }

  setTheme(theme: Theme): void {
    this.currentTheme.next(theme);
    localStorage.setItem('app-theme', theme);
    
    // Apply theme class to body
    const body = document.body;
    body.classList.remove('theme-default', 'theme-dark');
    body.classList.add(`theme-${theme}`);
  }

  getCurrentTheme(): Theme {
    return this.currentTheme.value;
  }

  toggleTheme(): void {
    const newTheme = this.currentTheme.value === 'dark' ? 'default' : 'dark';
    this.setTheme(newTheme);
  }
}
