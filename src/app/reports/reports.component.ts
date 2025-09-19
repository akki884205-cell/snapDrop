import { Component, OnInit } from '@angular/core';
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
  pageSize = 50;

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
  trendDays = 30;
  dateFrom: string = '';
  dateTo: string = '';

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
    this.dateFrom = this.toInputDate(start);
    this.dateTo = this.toInputDate(end);

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
      next: (data) => { this.blockedDomains = data; this.blockedLoading = false; },
      error: () => { this.blockedError = 'Failed to load blocked domains'; this.blockedLoading = false; }
    });
  }

  loadViolators(): void {
    this.violatorsLoading = true;
    this.violatorsError = '';
    this.reports.getTopViolators(1000).subscribe({
      next: (data) => { this.violators = data; this.violatorsLoading = false; },
      error: () => { this.violatorsError = 'Failed to load violators'; this.violatorsLoading = false; }
    });
  }

  loadTrend(): void {
    this.trendLoading = true;
    this.trendError = '';
    const days = this.computeSelectedDays();
    this.reports.getRequestsTrend(days, this.trendGranularity).subscribe({
      next: (data) => { this.trend = data; this.trendLoading = false; },
      error: () => { this.trendError = 'Failed to load trend'; this.trendLoading = false; }
    });
  }

  // Helpers
  toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  computeSelectedDays(): number {
    const from = new Date(this.dateFrom + 'T00:00:00Z').getTime();
    const to = new Date(this.dateTo + 'T23:59:59Z').getTime();
    const diff = Math.max(1, Math.ceil((to - from) / (24*60*60*1000)) + 1);
    this.trendDays = diff;
    return diff;
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
    return term ? this.violators.filter(v => v.ip.includes(term)) : this.violators;
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
    this.showIPModal = true;
  }
  closeIPModal(): void { this.showIPModal = false; }

  get violatorsByCountry() {
    const map: Record<string, number> = {};
    this.violators.forEach(v => { const c = v.country || 'US'; map[c] = (map[c] || 0) + v.totalViolations; });
    return Object.keys(map).map(k => ({ country: k, value: map[k] }));
  }
  get violatorsPieData() {
    return this.violators.slice(0, 10).map(v => ({ label: v.ip, value: v.totalViolations }));
  }

  // Trend derived
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
  onRangeChange(): void { this.loadTrend(); }

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
