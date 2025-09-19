import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface BlockedDomain {
  domain: string;
  blockCount: number;
  lastBlocked: number; // timestamp
}

export interface ViolatorIP {
  ip: string;
  totalViolations: number;
  lastSeen: number; // timestamp
  country?: string;
}

export interface RequestsPoint {
  timestamp: number; // ms epoch
  allowed: number;
  blocked: number;
}

export type Granularity = 'hour' | 'day';

interface CacheEntry<T> {
  data: T;
  ts: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly ttl = 60_000; // 60s cache

  getTopBlockedDomains(count = 1000, seed = 1): Observable<BlockedDomain[]> {
    const key = `blocked:${count}:${seed}`;
    const cached = this.fromCache<BlockedDomain[]>(key);
    if (cached) return of(cached);

    const data = this.generateBlockedDomains(count, seed);
    this.toCache(key, data);
    return of(data).pipe(delay(300));
  }

  getTopViolators(count = 1000, seed = 2): Observable<ViolatorIP[]> {
    const key = `violators:${count}:${seed}`;
    const cached = this.fromCache<ViolatorIP[]>(key);
    if (cached) return of(cached);

    const data = this.generateViolators(count, seed);
    this.toCache(key, data);
    return of(data).pipe(delay(300));
  }

  getRequestsTrend(days = 30, granularity: Granularity = 'day', seed = 3): Observable<RequestsPoint[]> {
    const key = `trend:${days}:${granularity}:${seed}`;
    const cached = this.fromCache<RequestsPoint[]>(key);
    if (cached) return of(cached);

    const data = this.generateTrend(days, granularity, seed);
    this.toCache(key, data);
    return of(data).pipe(delay(300));
  }

  private fromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private toCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, ts: Date.now() });
  }

  private generateBlockedDomains(count: number, seed: number): BlockedDomain[] {
    const rand = this.prng(seed);
    const now = Date.now();
    const domains: BlockedDomain[] = [];
    for (let i = 0; i < count; i++) {
      const base = Math.floor((count - i) * (50 + rand() * 50));
      domains.push({
        domain: `blocked${i + 1}.example.com`,
        blockCount: base + Math.floor(rand() * 50),
        lastBlocked: now - Math.floor(rand() * 7 * 24 * 60 * 60 * 1000)
      });
    }
    return domains.sort((a, b) => b.blockCount - a.blockCount);
  }

  private generateViolators(count: number, seed: number): ViolatorIP[] {
    const rand = this.prng(seed * 7);
    const now = Date.now();
    const countries = ['US','IN','CN','RU','BR','DE','GB','FR','AU','CA','ZA','JP','KR','SG','AE','NL','SE','IT','ES','MX'];
    const list: ViolatorIP[] = [];
    for (let i = 0; i < count; i++) {
      const ip = `${10 + (i % 200)}.${Math.floor(rand()*255)}.${Math.floor(rand()*255)}.${Math.floor(rand()*255)}`;
      const total = Math.floor((count - i) * (5 + rand()*10));
      list.push({
        ip,
        totalViolations: total,
        lastSeen: now - Math.floor(rand()*5*24*60*60*1000),
        country: countries[Math.floor(rand()*countries.length)]
      });
    }
    return list.sort((a, b) => b.totalViolations - a.totalViolations);
  }

  private generateTrend(days: number, granularity: Granularity, seed: number): RequestsPoint[] {
    const rand = this.prng(seed * 13);
    const points: RequestsPoint[] = [];
    const now = Date.now();

    const stepMs = granularity === 'day' ? 24*60*60*1000 : 60*60*1000;
    const count = granularity === 'day' ? days : days * 24;
    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * stepMs;
      const base = 5000 + Math.floor(rand()*3000);
      const swing = Math.sin((i / count) * Math.PI * 2) * 800;
      const blocked = Math.max(0, Math.floor(base*0.3 + swing + rand()*200));
      const allowed = Math.max(0, Math.floor(base*0.7 - swing + rand()*300));
      points.push({ timestamp: t, allowed, blocked });
    }
    return points;
  }

  private prng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 1000) / 1000;
    };
  }
}
