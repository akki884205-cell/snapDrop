import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export interface LinePoint { t: number; a: number; b: number; }

@Component({
  selector: 'app-line-area-chart',
  templateUrl: './line-area-chart.component.html',
  styleUrls: ['./line-area-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LineAreaChartComponent {
  @Input() points: LinePoint[] = [];
  @Input() showPercent = false;
  @Input() ariaLabel = 'Allowed vs Blocked requests over time';

  width = 600;
  height = 220;
  padding = { top: 10, right: 10, bottom: 20, left: 40 };

  get innerW() { return this.width - this.padding.left - this.padding.right; }
  get innerH() { return this.height - this.padding.top - this.padding.bottom; }

  get xDomain(): [number, number] {
    if (!this.points.length) return [0, 1];
    return [this.points[0].t, this.points[this.points.length - 1].t];
    }

  yMax(): number {
    if (!this.points.length) return 1;
    if (this.showPercent) return 100;
    return Math.max(...this.points.map(p => p.a + p.b)) * 1.1;
  }

  xScale(t: number): number {
    const [t0, t1] = this.xDomain;
    if (t1 === t0) return this.padding.left;
    return this.padding.left + ((t - t0) / (t1 - t0)) * this.innerW;
  }

  yScale(v: number): number {
    const max = this.yMax();
    return this.padding.top + this.innerH - (v / max) * this.innerH;
  }

  areaPath(getVal: (p: LinePoint) => number): string {
    if (!this.points.length) return '';
    const coords = this.points.map(p => {
      const total = p.a + p.b;
      const val = this.showPercent ? (total ? (getVal(p) / total) * 100 : 0) : getVal(p);
      return `${this.xScale(p.t)},${this.yScale(val)}`;
    });
    // Close to baseline
    const last = this.points[this.points.length - 1];
    const first = this.points[0];
    const baselineY = this.yScale(0);
    return `M ${this.xScale(first.t)},${baselineY} L ${coords.join(' L ')} L ${this.xScale(last.t)},${baselineY} Z`;
  }

  linePath(getVal: (p: LinePoint) => number): string {
    if (!this.points.length) return '';
    const parts: string[] = [];
    this.points.forEach((p, i) => {
      const total = p.a + p.b;
      const val = this.showPercent ? (total ? (getVal(p) / total) * 100 : 0) : getVal(p);
      parts.push(`${i === 0 ? 'M' : 'L'} ${this.xScale(p.t)},${this.yScale(val)}`);
    });
    return parts.join(' ');
  }
}
