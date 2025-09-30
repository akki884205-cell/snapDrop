import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { WhitelistEntry, WhitelistEntryType } from '../models/whitelist-entry.model';

export type WhitelistChangeKind = 'ADD' | 'UPDATE' | 'REMOVE';

type AddressFamily = 'IPv4' | 'IPv6';

interface WhitelistValidationResult {
  valid: boolean;
  type?: WhitelistEntryType;
  message?: string;
  warning?: string;
  family?: AddressFamily;
  prefixLength?: number;
}

interface ParsedNetwork {
  family: AddressFamily;
  start: bigint;
  end: bigint;
  prefix: number;
}

@Injectable({ providedIn: 'root' })
export class WhitelistService {
  private readonly dataUrl = 'assets/data/whitelist.json';
  private readonly limit = 10000;
  private readonly store = new BehaviorSubject<WhitelistEntry[]>([]);
  private readonly excludedEntries = new Set(['0.0.0.0', '::/128', '::1/128'].map(item => item.toLowerCase()));
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
          active: entry.active !== false,
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

    const conflict = this.findConflict(trimmed);
    if (conflict) {
      return throwError(() => new Error(conflict));
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
      updatedAt: timestamp,
      active: true
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

    const conflict = this.findConflict(trimmed, id);
    if (conflict) {
      return throwError(() => new Error(conflict));
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
    const current = [...this.store.value];
    const index = current.findIndex(item => item.id === id);
    if (index === -1) {
      return throwError(() => new Error('Whitelist entry not found.'));
    }

    const [removed] = current.splice(index, 1);
    this.store.next(current);
    this.broadcastUpdate('REMOVE', removed);
    return of(void 0);
  }

  validateValue(value: string): WhitelistValidationResult {
    const trimmed = value.trim();
    if (!trimmed) {
      return { valid: false, message: 'Value is required.' };
    }

    if (this.isExcluded(trimmed)) {
      return { valid: false, message: `${trimmed} cannot be added to the whitelist.` };
    }

    if (trimmed.includes('/')) {
      return this.validateCidr(trimmed);
    }

    if (this.isIPv4(trimmed)) {
      return { valid: true, type: 'IPv4', family: 'IPv4', prefixLength: 32 };
    }

    if (this.isIPv6(trimmed)) {
      return { valid: true, type: 'IPv6', family: 'IPv6', prefixLength: 128 };
    }

    return { valid: false, message: 'Enter a valid IPv4, IPv6, or CIDR subnet.' };
  }

  assessConflicts(value: string, ignoreId?: string): string | null {
    return this.findConflict(value.trim(), ignoreId);
  }

  private validateCidr(input: string): WhitelistValidationResult {
    const [rawIp, prefix] = input.split('/');
    const ip = rawIp.trim();
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

      if (prefixNum > 24) {
        return { valid: false, message: 'IPv4 subnets must use a prefix between /16 and /24.' };
      }

      const warning = prefixNum < 16
        ? `${input} is broader than /16 and may allow excessive traffic. Continue?`
        : undefined;

      return { valid: true, type: 'CIDR', family: 'IPv4', prefixLength: prefixNum, warning };
    }

    if (this.isIPv6(ip)) {
      if (prefixNum < 0 || prefixNum > 128) {
        return { valid: false, message: 'IPv6 CIDR prefix must be between 0 and 128.' };
      }

      if (prefixNum < 64) {
        return { valid: false, message: 'IPv6 subnets must use a prefix of /64 or more.' };
      }

      const warning = prefixNum === 64
        ? `${input} covers an entire /64 IPv6 segment. Continue?`
        : undefined;

      return { valid: true, type: 'CIDR', family: 'IPv6', prefixLength: prefixNum, warning };
    }

    return { valid: false, message: 'CIDR must start with a valid IPv4 or IPv6 address.' };
  }

  private findConflict(value: string, ignoreId?: string): string | null {
    const normalizedValue = this.normalizeValue(value);
    const target = this.parseNetwork(normalizedValue);
    if (!target) {
      return null;
    }

    for (const entry of this.store.value) {
      if (ignoreId && entry.id === ignoreId) {
        continue;
      }

      const entryValue = this.normalizeValue(entry.value);
      if (entryValue.toLowerCase() === normalizedValue.toLowerCase()) {
        return 'Entry already exists in the whitelist.';
      }

      const existing = this.parseNetwork(entryValue);
      if (!existing || existing.family !== target.family) {
        continue;
      }

      if (this.networkContains(existing, target)) {
        if (existing.start === target.start && existing.end === target.end) {
          return 'Entry already exists in the whitelist.';
        }
        return `${value} is already covered by existing entry ${entry.value}.`;
      }

      if (this.networkContains(target, existing)) {
        return `Existing entry ${entry.value} is narrower than ${value}. Remove it before adding broader ranges.`;
      }
    }

    return null;
  }

  private parseNetwork(value: string): ParsedNetwork | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.includes('/')) {
      const [ip, prefixPart] = trimmed.split('/');
      const prefixNum = Number(prefixPart);
      if (!Number.isInteger(prefixNum)) {
        return null;
      }

      if (this.isIPv4(ip)) {
        const address = this.ipv4ToBigInt(ip);
        const range = this.computeNetworkRange(address, prefixNum, 'IPv4');
        return { family: 'IPv4', prefix: prefixNum, ...range };
      }

      if (this.isIPv6(ip)) {
        const address = this.ipv6ToBigInt(ip);
        if (address === null) {
          return null;
        }
        const range = this.computeNetworkRange(address, prefixNum, 'IPv6');
        return { family: 'IPv6', prefix: prefixNum, ...range };
      }

      return null;
    }

    if (this.isIPv4(trimmed)) {
      const address = this.ipv4ToBigInt(trimmed);
      const range = this.computeNetworkRange(address, 32, 'IPv4');
      return { family: 'IPv4', prefix: 32, ...range };
    }

    if (this.isIPv6(trimmed)) {
      const address = this.ipv6ToBigInt(trimmed);
      if (address === null) {
        return null;
      }
      const range = this.computeNetworkRange(address, 128, 'IPv6');
      return { family: 'IPv6', prefix: 128, ...range };
    }

    return null;
  }

  private networkContains(container: ParsedNetwork, candidate: ParsedNetwork): boolean {
    return container.family === candidate.family && container.start <= candidate.start && container.end >= candidate.end;
  }

  private ipv4ToBigInt(value: string): bigint {
    return value.split('.').reduce((acc, part) => (acc << 8n) + BigInt(Number(part)), 0n);
  }

  private ipv6ToBigInt(value: string): bigint | null {
    const segments = this.parseIPv6Segments(value);
    if (!segments) {
      return null;
    }

    return segments.reduce((acc, segment) => (acc << 16n) + BigInt(segment), 0n);
  }

  private parseIPv6Segments(value: string): number[] | null {
    let address = value;
    const zoneIndex = address.indexOf('%');
    if (zoneIndex !== -1) {
      address = address.slice(0, zoneIndex);
    }

    if (address.includes('::')) {
      const [left, right] = address.split('::');
      const leftParts = left ? left.split(':') : [];
      const rightParts = right ? right.split(':') : [];

      const leftSegments = this.expandIPv6Parts(leftParts);
      const rightSegments = this.expandIPv6Parts(rightParts);
      if (!leftSegments || !rightSegments) {
        return null;
      }

      const missing = 8 - (leftSegments.length + rightSegments.length);
      if (missing < 0) {
        return null;
      }

      return [...leftSegments, ...Array(missing).fill(0), ...rightSegments];
    }

    const parts = address.split(':');
    const segments = this.expandIPv6Parts(parts);
    if (!segments || segments.length !== 8) {
      return null;
    }

    return segments;
  }

  private expandIPv6Parts(parts: string[]): number[] | null {
    const segments: number[] = [];
    for (const part of parts) {
      if (!part) {
        continue;
      }
      if (part.includes('.')) {
        const ipv4Segments = part.split('.').map(num => Number(num));
        if (ipv4Segments.length !== 4 || ipv4Segments.some(seg => !Number.isInteger(seg) || seg < 0 || seg > 255)) {
          return null;
        }
        segments.push((ipv4Segments[0] << 8) + ipv4Segments[1]);
        segments.push((ipv4Segments[2] << 8) + ipv4Segments[3]);
        continue;
      }
      const parsed = parseInt(part, 16);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 0xFFFF) {
        return null;
      }
      segments.push(parsed);
    }
    return segments;
  }

  private computeNetworkRange(address: bigint, prefix: number, family: AddressFamily): { start: bigint; end: bigint } {
    const bits = family === 'IPv4' ? 32n : 128n;
    if (prefix < 0 || prefix > Number(bits)) {
      return { start: 0n, end: this.getMaxAddress(family) };
    }

    const prefixBig = BigInt(prefix);
    const shift = bits - prefixBig;

    const networkMask = prefix === 0
      ? 0n
      : ((1n << prefixBig) - 1n) << shift;

    const start = address & networkMask;
    const hostMask = prefix === Number(bits)
      ? 0n
      : (1n << shift) - 1n;

    const end = start | hostMask;
    return { start, end };
  }

  private getMaxAddress(family: AddressFamily): bigint {
    const bits = family === 'IPv4' ? 32n : 128n;
    return (1n << bits) - 1n;
  }

  private isExcluded(value: string): boolean {
    return this.excludedEntries.has(value.toLowerCase());
  }

  private normalizeValue(value: string): string {
    return value.trim();
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
    const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9])?[0-9]))$/;
    return ipv6Pattern.test(value);
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
        updatedAt: timestamp,
        active: true
      }
    ];
  }
}
