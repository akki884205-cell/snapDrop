import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { WhitelistEntry, WhitelistEntryType } from '../models/whitelist-entry.model';

export type WhitelistChangeKind = 'ADD' | 'UPDATE' | 'REMOVE';

interface WhitelistValidationResult {
  valid: boolean;
  type?: WhitelistEntryType;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class WhitelistService {
  private readonly dataUrl = 'assets/data/whitelist.json';
  private readonly limit = 10000;
  private readonly store = new BehaviorSubject<WhitelistEntry[]>([]);
  private loaded = false;

  constructor(private http: HttpClient) {}

  get maxEntries(): number { return this.limit; }

  get entries$(): Observable<WhitelistEntry[]> {
    if (!this.loaded) {
      this.loaded = true;
      this.http.get<WhitelistEntry[]>(this.dataUrl).pipe(
        catchError(() => of(this.seedEntries())),
        map(list => list.map(entry => ({
          ...entry,
          createdAt: new Date(entry.createdAt).toISOString(),
          updatedAt: new Date(entry.updatedAt).toISOString()
        })))
      ).subscribe(list => this.store.next(this.sortEntries(list)));
    }

    return this.store.asObservable();
  }

  addEntry(value: string, description?: string): Observable<WhitelistEntry> {
    const trimmed = value.trim();
    const validation = this.validateValue(trimmed);
    if (!validation.valid || !validation.type) {
      return throwError(() => new Error(validation.message || 'Invalid entry'));
    }

    const current = this.store.value;
    if (current.length >= this.limit) {
      return throwError(() => new Error(`Whitelist limit of ${this.limit} entries reached.`));
    }

    const timestamp = new Date().toISOString();
    const entry: WhitelistEntry = {
      id: this.createId(trimmed),
      value: trimmed,
      type: trimmed.includes('/') ? 'CIDR' : validation.type,
      description: description?.trim() || undefined,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const updated = this.sortEntries([entry, ...current]);
    this.store.next(updated);
    this.broadcastUpdate('ADD', entry);
    return of(entry);
  }

  updateEntry(id: string, value: string, description?: string): Observable<WhitelistEntry> {
    const trimmed = value.trim();
    const validation = this.validateValue(trimmed);
    if (!validation.valid || !validation.type) {
      return throwError(() => new Error(validation.message || 'Invalid entry'));
    }

    const current = [...this.store.value];
    const index = current.findIndex(item => item.id === id);
    if (index === -1) {
      return throwError(() => new Error('Whitelist entry not found.'));
    }

    const existing = current[index];
    const updatedEntry: WhitelistEntry = {
      ...existing,
      value: trimmed,
      type: trimmed.includes('/') ? 'CIDR' : validation.type,
      description: description?.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    current.splice(index, 1, updatedEntry);
    this.store.next(this.sortEntries(current));
    this.broadcastUpdate('UPDATE', updatedEntry);
    return of(updatedEntry);
  }

  removeEntry(id: string): Observable<void> {
    const current = this.store.value;
    const index = current.findIndex(item => item.id === id);
    if (index === -1) {
      return throwError(() => new Error('Whitelist entry not found.'));
    }

    const [removed] = current.splice(index, 1);
    this.store.next([...current]);
    this.broadcastUpdate('REMOVE', removed);
    return of(void 0);
  }

  validateValue(value: string): WhitelistValidationResult {
    const trimmed = value.trim();
    if (!trimmed) {
      return { valid: false, message: 'Value is required.' };
    }

    if (trimmed.includes('/')) {
      return this.validateCidr(trimmed);
    }

    if (this.isIPv4(trimmed)) {
      return { valid: true, type: 'IPv4' };
    }

    if (this.isIPv6(trimmed)) {
      return { valid: true, type: 'IPv6' };
    }

    return { valid: false, message: 'Enter a valid IPv4, IPv6, or CIDR subnet.' };
  }

  private validateCidr(input: string): WhitelistValidationResult {
    const [ip, prefix] = input.split('/');
    if (!ip || prefix === undefined) {
      return { valid: false, message: 'CIDR notation must include address and prefix (e.g., 10.0.0.0/24).' };
    }

    const prefixNum = Number(prefix);
    if (!Number.isInteger(prefixNum)) {
      return { valid: false, message: 'CIDR prefix must be an integer.' };
    }

    if (this.isIPv4(ip)) {
      if (prefixNum < 0 || prefixNum > 32) {
        return { valid: false, message: 'IPv4 CIDR prefix must be between 0 and 32.' };
      }
      return { valid: true, type: 'CIDR' };
    }

    if (this.isIPv6(ip)) {
      if (prefixNum < 0 || prefixNum > 128) {
        return { valid: false, message: 'IPv6 CIDR prefix must be between 0 and 128.' };
      }
      return { valid: true, type: 'CIDR' };
    }

    return { valid: false, message: 'CIDR must start with a valid IPv4 or IPv6 address.' };
  }

  private isIPv4(value: string): boolean {
    const parts = value.split('.');
    if (parts.length !== 4) {
      return false;
    }

    return parts.every(part => {
      if (part.length === 0 || part.length > 3) {
        return false;
      }
      if (!/^[0-9]+$/.test(part)) {
        return false;
      }
      const num = Number(part);
      if (num < 0 || num > 255) {
        return false;
      }
      return !(part.length > 1 && part.startsWith('0'));
    });
  }

  private isIPv6(value: string): boolean {
    const segments = value.split(':');
    if (segments.length < 3 || segments.length > 8) {
      if (!value.includes('::')) {
        return false;
      }
    }

    if (value.includes('::')) {
      if (value.indexOf('::') !== value.lastIndexOf('::')) {
        return false; // only one :: allowed
      }
      const replacement = '0:'.repeat(8 - segments.filter(segment => segment.length > 0).length + 1);
      const expanded = value.replace('::', `:${replacement}`).replace('::', ':');
      return this.isIPv6(expanded.startsWith(':') ? expanded.slice(1) : expanded);
    }

    if (segments.length !== 8) {
      return false;
    }

    return segments.every(segment => /^[0-9a-fA-F]{1,4}$/.test(segment));
  }

  private sortEntries(list: WhitelistEntry[]): WhitelistEntry[] {
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private createId(value: string): string {
    const hash = Math.abs(this.hashCode(value + Date.now().toString()));
    return `wl-${hash.toString(16)}`;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  private broadcastUpdate(kind: WhitelistChangeKind, entry: WhitelistEntry): void {
    const message = {
      actionCode: 1,
      change: kind,
      payload: {
        id: entry.id,
        value: entry.value,
        type: entry.type,
        description: entry.description,
        timestamp: entry.updatedAt
      }
    };

    console.info('[Spectra→Aegis] Whitelist update', message);
  }

  private seedEntries(): WhitelistEntry[] {
    const timestamp = new Date().toISOString();
    return [
      {
        id: 'wl-seed-1',
        value: '192.168.50.12',
        type: 'IPv4',
        description: 'Seed desktop host',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
  }
}
