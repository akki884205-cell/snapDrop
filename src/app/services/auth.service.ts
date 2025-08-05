import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  message: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api'; // Mock API base URL
  private currentUser: User | null = null;
  private authToken: string | null = null;

  // Mock user database
  private mockUsers: { [email: string]: { password: string; user: User } } = {
    'admin@snapdrop.com': {
      password: 'admin123',
      user: {
        id: '1',
        email: 'admin@snapdrop.com',
        name: 'Admin User',
        role: 'admin'
      }
    },
    'user@snapdrop.com': {
      password: 'user123',
      user: {
        id: '2',
        email: 'user@snapdrop.com',
        name: 'Regular User',
        role: 'user'
      }
    },
    'demo@snapdrop.com': {
      password: 'demo123',
      user: {
        id: '3',
        email: 'demo@snapdrop.com',
        name: 'Demo User',
        role: 'demo'
      }
    }
  };

  constructor(private http: HttpClient) {
    // Check for existing session
    this.loadStoredAuth();
  }

  /**
   * Mock login API call
   */
  login(email: string, password: string): Observable<LoginResponse> {
    console.log(`[AUTH SERVICE] Login attempt for: ${email}`);
    
    // Simulate API delay
    return of(null).pipe(
      delay(1500), // 1.5 second delay to simulate network request
      map(() => {
        const user = this.mockUsers[email.toLowerCase()];
        
        if (!user) {
          throw new Error('User not found. Please check your email address.');
        }
        
        if (user.password !== password) {
          throw new Error('Invalid password. Please try again.');
        }
        
        // Generate mock JWT token
        const token = this.generateMockToken(user.user);
        
        // Store authentication data
        this.currentUser = user.user;
        this.authToken = token;
        this.storeAuth(token, user.user);
        
        const response: LoginResponse = {
          success: true,
          token: token,
          user: user.user,
          message: 'Login successful'
        };
        
        console.log('[AUTH SERVICE] Login successful:', response);
        return response;
      })
    );
  }

  /**
   * Mock forgot password API call
   */
  forgotPassword(email: string): Observable<ApiResponse> {
    console.log(`[AUTH SERVICE] Password reset request for: ${email}`);
    
    return of(null).pipe(
      delay(1000),
      map(() => {
        const user = this.mockUsers[email.toLowerCase()];
        
        if (!user) {
          throw new Error('Email address not found in our system.');
        }
        
        const response: ApiResponse = {
          success: true,
          message: 'Password reset instructions have been sent to your email address.'
        };
        
        console.log('[AUTH SERVICE] Password reset email sent:', response);
        return response;
      })
    );
  }

  /**
   * Mock logout
   */
  logout(): Observable<ApiResponse> {
    console.log('[AUTH SERVICE] Logging out user');
    
    return of(null).pipe(
      delay(500),
      map(() => {
        this.currentUser = null;
        this.authToken = null;
        this.clearStoredAuth();
        
        return {
          success: true,
          message: 'Logged out successfully'
        };
      })
    );
  }

  /**
   * Mock user profile fetch
   */
  getUserProfile(): Observable<User> {
    if (!this.isAuthenticated()) {
      return throwError(() => new Error('User not authenticated'));
    }
    
    return of(this.currentUser!).pipe(delay(500));
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authToken !== null && this.currentUser !== null;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Mock API call to validate token
   */
  validateToken(): Observable<boolean> {
    if (!this.authToken) {
      return of(false);
    }
    
    return of(true).pipe(delay(300));
  }

  /**
   * Generate a mock JWT token
   */
  private generateMockToken(user: User): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }));
    const signature = btoa('mock-signature-' + Math.random().toString(36));
    
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Store authentication data in localStorage
   */
  private storeAuth(token: string, user: User): void {
    try {
      localStorage.setItem('snapdrop_token', token);
      localStorage.setItem('snapdrop_user', JSON.stringify(user));
    } catch (error) {
      console.warn('[AUTH SERVICE] Failed to store auth data:', error);
    }
  }

  /**
   * Load stored authentication data
   */
  private loadStoredAuth(): void {
    try {
      const token = localStorage.getItem('snapdrop_token');
      const userStr = localStorage.getItem('snapdrop_user');
      
      if (token && userStr) {
        this.authToken = token;
        this.currentUser = JSON.parse(userStr);
        console.log('[AUTH SERVICE] Loaded stored authentication');
      }
    } catch (error) {
      console.warn('[AUTH SERVICE] Failed to load stored auth:', error);
      this.clearStoredAuth();
    }
  }

  /**
   * Clear stored authentication data
   */
  private clearStoredAuth(): void {
    try {
      localStorage.removeItem('snapdrop_token');
      localStorage.removeItem('snapdrop_user');
    } catch (error) {
      console.warn('[AUTH SERVICE] Failed to clear stored auth:', error);
    }
  }
}
