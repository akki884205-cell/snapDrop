import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { ReportsService, BlockedDomain, ViolatorIP, RequestsPoint, Granularity } from '../services/reports.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  currentUser: User | null = null;
  activeTab: string = 'dashboards';

  // Collapsible states
  showBlocked = true;
  showViolators = true;
  showTrend = true;

  // Blocked domains state
  blockedLoading = false;
  blockedError = '';
  blockedDomains: BlockedDomain[] = [];
  blockedSearch = '';
  blockedPage = 1;
  pageSize = 10;

  // Violators state
  violatorsLoading = false;
  violatorsError = '';
  violators: ViolatorIP[] = [];
  violatorSearch = '';
  violatorsPage = 1;
  selectedIP: ViolatorIP | null = null;
  showIPModal = false;

  // Trend state
  trendLoading = false;
  trendError = '';
  trend: RequestsPoint[] = [];
  trendGranularity: Granularity = 'day';
  trendShowPercent = false;

  // Global Time Range
  globalPreset: '24h'|'7d'|'30d'|'90d'|'custom' = '30d';
  globalFrom = '';
  globalTo = '';

  // Selections for cross-filter
  selectedCountry: string | null = null;
  selectedDomainLabel: string | null = null;
  selectedViolatorIP: string | null = null;
  hoveredCountry: string | null = null;
  bubbleSortActive = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private reports: ReportsService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/']);
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    this.globalFrom = this.toInputDate(start);
    this.globalTo = this.toInputDate(end);

    this.loadBlocked();
    this.loadViolators();
    this.loadTrend();
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
  }

  onViewServiceSensor(): void {
    this.router.navigate(['/service-sensor']);
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

  // Loaders
  loadBlocked(): void {
    this.blockedLoading = true;
    this.blockedError = '';
    this.reports.getTopBlockedDomains(1000).subscribe({
      next: (data) => {
        const [from, to] = this.currentRangeMs();
        this.blockedDomains = data.filter(d => d.lastBlocked >= from && d.lastBlocked <= to);
        this.blockedLoading = false;
      },
      error: () => { this.blockedError = 'Failed to load blocked domains'; this.blockedLoading = false; }
    });
  }

  loadViolators(): void {
    this.violatorsLoading = true;
    this.violatorsError = '';
    this.reports.getTopViolators(1000).subscribe({
      next: (data) => {
        const [from, to] = this.currentRangeMs();
        this.violators = data.filter(v => v.lastSeen >= from && v.lastSeen <= to);
        this.violatorsLoading = false;
      },
      error: () => { this.violatorsError = 'Failed to load violators'; this.violatorsLoading = false; }
    });
  }

  private trendRequestId = 0;
  loadTrend(): void {
    this.trendLoading = true;
    this.trendError = '';
    const days = this.rangeDays();
    const reqId = ++this.trendRequestId;
    this.reports.getRequestsTrend(days, this.trendGranularity).subscribe({
      next: (data) => {
        if (reqId !== this.trendRequestId) return; // ignore stale responses
        this.trend = data;
        this.endTrendLoading();
      },
      error: () => { if (reqId === this.trendRequestId) { this.trendError = 'Failed to load trend'; this.trendLoading = false; } }
    });
  }

  private endTrendLoading(): void {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => { this.trendLoading = false; });
    } else {
      setTimeout(() => { this.trendLoading = false; }, 0);
    }
  }

  // Helpers
  toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  currentRangeMs(): [number, number] {
    let from: number;
    let to: number = new Date().getTime();
    if (this.globalPreset !== 'custom') {
      const map = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as const;
      const days = map[this.globalPreset] ?? 30;
      from = to - days * 24 * 60 * 60 * 1000;
    } else {
      from = new Date(this.globalFrom + 'T00:00:00Z').getTime();
      to = new Date(this.globalTo + 'T23:59:59Z').getTime();
    }
    return [from, to];
  }

  rangeDays(): number {
    const [from, to] = this.currentRangeMs();
    return Math.max(1, Math.ceil((to - from) / (24*60*60*1000)));
  }

  // Blocked table derived
  get blockedFiltered(): BlockedDomain[] {
    const term = this.blockedSearch.toLowerCase().trim();
    const list = term ? this.blockedDomains.filter(d => d.domain.toLowerCase().includes(term)) : this.blockedDomains;
    return list;
  }
  get blockedTotalPages(): number { return Math.ceil(this.blockedFiltered.length / this.pageSize) || 1; }
  get blockedPageItems(): BlockedDomain[] {
    const start = (this.blockedPage - 1) * this.pageSize;
    return this.blockedFiltered.slice(start, start + this.pageSize);
  }
  onBlockedPageChange(delta: number): void {
    const next = Math.min(this.blockedTotalPages, Math.max(1, this.blockedPage + delta));
    this.blockedPage = next;
  }
  exportBlockedCSV(): void {
    const rows = [['Domain Name','Block Count','Last Blocked Timestamp'], ...this.blockedFiltered.map(d => [d.domain, String(d.blockCount), new Date(d.lastBlocked).toISOString()])];
    this.downloadCSV(rows, 'top-blocked-domains.csv');
  }
  exportBlockedExcel(): void {
    this.downloadExcelTable(this.blockedFiltered, ['domain','blockCount','lastBlocked'], ['Domain Name','Block Count','Last Blocked Timestamp'], 'top-blocked-domains.xls');
  }

  get blockedTopForChart() {
    return this.blockedDomains.slice(0, 20).map(d => ({ label: d.domain, value: d.blockCount }));
  }
  get blockedSummaryUnique(): number { return this.blockedDomains.length; }

  // Violators table derived
  get violatorsFiltered(): ViolatorIP[] {
    const term = this.violatorSearch.trim();
    let list = term ? this.violators.filter(v => v.ip.includes(term)) : this.violators;
    if (this.selectedCountry) {
      list = list.filter(v => (v.country || '') === this.selectedCountry);
    }
    return list;
  }
  get violatorsTotalPages(): number { return Math.ceil(this.violatorsFiltered.length / this.pageSize) || 1; }
  get violatorsPageItems(): ViolatorIP[] {
    const start = (this.violatorsPage - 1) * this.pageSize;
    return this.violatorsFiltered.slice(start, start + this.pageSize);
  }
  onViolatorsPageChange(delta: number): void {
    const next = Math.min(this.violatorsTotalPages, Math.max(1, this.violatorsPage + delta));
    this.violatorsPage = next;
  }
  onRowClick(v: ViolatorIP): void {
    this.selectedIP = v;
    this.selectedCountry = v.country || null;
    this.selectedViolatorIP = v.ip;
    this.violatorSearch = v.ip;
    this.showIPModal = true;
  }
  closeIPModal(): void { this.showIPModal = false; }

  get violatorsByCountry() {
    const map: Record<string, number> = {};
    this.violatorsFiltered.forEach(v => { const c = v.country || 'US'; map[c] = (map[c] || 0) + v.totalViolations; });
    let arr = Object.keys(map).map(k => ({ country: k, value: map[k] }));

    // Prioritize hovered country if any
    if (this.hoveredCountry) {
      arr = arr.sort((a, b) => (a.country === this.hoveredCountry ? -1 : b.country === this.hoveredCountry ? 1 : 0));
      return arr;
    }

    // Sort bubbles when filter focused, else stable alphabetical
    if (this.bubbleSortActive) {
      arr.sort((a, b) => b.value - a.value);
    } else {
      arr.sort((a, b) => a.country.localeCompare(b.country));
    }
    return arr;
  }
  get violatorsPieData() {
    return this.violators.slice(0, 10).map(v => ({ label: v.ip, value: v.totalViolations }));
  }

  // Trend derived
  onCountrySelect(country: string): void { this.selectedCountry = country; this.bubbleSortActive = false; }

  onDomainBarSelect(label: string): void { this.blockedSearch = label; this.blockedPage = 1; }

  onPieSelect(label: string): void { this.selectedViolatorIP = label; this.violatorSearch = label; this.violatorsPage = 1; }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.resetAllFilters(); }

  resetAllFilters(): void {
    this.selectedCountry = null;
    this.selectedDomainLabel = null;
    this.selectedViolatorIP = null;
    this.hoveredCountry = null;
    this.bubbleSortActive = false;
    this.blockedSearch = '';
    this.violatorSearch = '';
    this.blockedPage = 1;
    this.violatorsPage = 1;
    this.trendShowPercent = false;
    this.globalPreset = '30d';
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    this.globalFrom = this.toInputDate(start);
    this.globalTo = this.toInputDate(end);
    this.refreshAll();
  }

  onViolatorFilterFocus(): void { this.bubbleSortActive = true; }
  onViolatorFilterBlur(): void { if (!this.selectedViolatorIP && !this.selectedCountry) { this.bubbleSortActive = false; } }

  onViolatorRowHover(v: ViolatorIP): void { this.hoveredCountry = v.country || null; }
  onViolatorRowLeave(): void { if (!this.selectedCountry) { this.hoveredCountry = null; } }

  get trendSummary() {
    const totalAllowed = this.trend.reduce((s, p) => s + p.allowed, 0);
    const totalBlocked = this.trend.reduce((s, p) => s + p.blocked, 0);
    const mid = Math.floor(this.trend.length / 2) || 1;
    const prevAllowed = this.trend.slice(0, mid).reduce((s, p) => s + p.allowed, 0);
    const prevBlocked = this.trend.slice(0, mid).reduce((s, p) => s + p.blocked, 0);
    const allowedChange = prevAllowed ? ((totalAllowed - prevAllowed) / prevAllowed) * 100 : 0;
    const blockedChange = prevBlocked ? ((totalBlocked - prevBlocked) / prevBlocked) * 100 : 0;
    return { totalAllowed, totalBlocked, allowedChange, blockedChange };
  }

  onTrendGranularity(g: Granularity): void {
    this.trendGranularity = g;
    this.loadTrend();
  }
  onTrendPercentToggle(v: boolean): void { this.trendShowPercent = v; }

  setGlobalPreset(preset: '24h'|'7d'|'30d'|'90d'|'custom'): void {
    this.globalPreset = preset;
    if (preset !== 'custom') {
      this.refreshAll();
    }
  }

  onGlobalRangeChange(): void { if (this.globalPreset === 'custom') this.refreshAll(); }

  refreshAll(): void {
    this.loadBlocked();
    this.loadViolators();
    this.loadTrend();
  }

  get trendLinePoints(): { t: number; a: number; b: number }[] {
    return this.trend.map(p => ({ t: p.timestamp, a: p.allowed, b: p.blocked }));
  }

  // Downloads
  private downloadCSV(rows: (string|number)[][], filename: string) {
    const csv = rows.map(r => r.map(x => '"' + String(x).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private downloadExcelTable<T extends Record<string, any>>(items: T[], keys: (keyof T)[], headers: string[], filename: string) {
    const table = ['<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>',
      ...items.map(it => '<tr>' + keys.map(k => `<td>${this.escapeHtml(String(k === 'lastBlocked' || k === 'lastSeen' ? new Date(it[k]).toISOString() : it[k]))}</td>`).join('') + '</tr>'),
      '</tbody></table>'].join('');
    const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private escapeHtml(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
