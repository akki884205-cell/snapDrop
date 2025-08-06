import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  currentUser: User | null = null;
  urlIpBlockingPreference: string = 'Off';
  showDropdown: boolean = false;

  blockingOptions = [
    { value: 'Off', label: 'Off' },
    { value: 'On', label: 'On' },
    { value: 'URLOnly', label: 'URL Only' },
    { value: 'IPOnly', label: 'IP Only' },
    { value: 'URLAndIP', label: 'URL + IP' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    // Temporarily disable auth check to test themes
    // if (!this.currentUser) {
    //   this.router.navigate(['/']);
    // }
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  selectOption(option: string): void {
    this.urlIpBlockingPreference = option;
    this.showDropdown = false;
    console.log('URL/IP Blocking Preference changed to:', option);
  }

  setDarkTheme(): void {
    this.themeService.setTheme('dark');
  }

  setLightTheme(): void {
    this.themeService.setTheme('default');
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
        this.router.navigate(['/']);
      }
    });
  }
}
