import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';

export interface HBarDatum { label: string; value: number; }

@Component({
  selector: 'app-hbar-chart',
  templateUrl: './hbar-chart.component.html',
  styleUrls: ['./hbar-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HbarChartComponent {
  @Input() data: HBarDatum[] = [];
  @Input() maxBars = 20;
  @Input() color = '#ff4757'; // red for blocked
  @Input() ariaLabel = 'Horizontal bar chart';
  @Output() selectLabel = new EventEmitter<string>();

  get topData(): HBarDatum[] {
    return (this.data || []).slice(0, this.maxBars);
  }

  get maxValue(): number {
    const vals = this.topData.map(d => d.value);
    return vals.length ? Math.max(...vals) : 0;
  }

  widthPercent(val: number): string {
    if (!this.maxValue) return '0%';
    const pct = Math.max(0, Math.min(100, (val / this.maxValue) * 100));
    return pct + '%';
  }

  onRowClick(label: string): void {
    this.selectLabel.emit(label);
  }
}
