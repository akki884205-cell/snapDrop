import { Component, Input, ChangeDetectionStrategy, ElementRef, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';

export interface LinePoint { t: number; a: number; b: number; }

@Component({
  selector: 'app-line-area-chart',
  templateUrl: './line-area-chart.component.html',
  styleUrls: ['./line-area-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LineAreaChartComponent implements AfterViewInit, OnDestroy {
  @Input() points: LinePoint[] = [];
  @Input() showPercent = false;
  @Input() ariaLabel = 'Allowed vs Blocked requests over time';

  width = 600;
  height = 220;
  private ro?: ResizeObserver;
  constructor(private el: ElementRef<HTMLElement>) {}
  padding = { top: 10, right: 10, bottom: 20, left: 40 };

  @ViewChild('svgEl') svgEl?: ElementRef<SVGSVGElement>;
  hoverIndex: number = -1;
  pinIndex: number | null = null;
  get ci(): number { return this.pinIndex ?? this.hoverIndex; }

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

  // Wrapper methods to use in templates (avoid arrow functions in templates)
  areaPathAllowed(): string { return this.areaPath(p => p.a); }
  areaPathBlocked(): string { return this.areaPath(p => p.b); }
  linePathAllowed(): string { return this.linePath(p => p.a); }
  linePathBlocked(): string { return this.linePath(p => p.b); }

  ngAfterViewInit(): void {
    const update = () => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      this.width = Math.max(320, Math.floor(rect.width));
    };
    update();
    this.ro = new ResizeObserver(() => update());
    this.ro.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.ro) {
      this.ro.disconnect();
      this.ro = undefined;
    }
  }

  private eventToX(evt: MouseEvent): number {
    const svg = this.svgEl?.nativeElement;
    const rect = svg ? svg.getBoundingClientRect() : this.el.nativeElement.getBoundingClientRect();
    return evt.clientX - rect.left;
  }

  private nearestIndexFromX(x: number): number {
    if (!this.points.length) return -1;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < this.points.length; i++) {
      const px = this.xScale(this.points[i].t);
      const d = Math.abs(px - x);
      if (d < best) { best = d; nearest = i; }
    }
    return nearest;
  }

  onMouseMove(evt: MouseEvent): void { this.hoverIndex = this.nearestIndexFromX(this.eventToX(evt)); }
  onMouseLeave(): void { this.hoverIndex = -1; }
  onClick(): void { this.pinIndex = this.hoverIndex >= 0 ? this.hoverIndex : null; }
  onKey(evt: KeyboardEvent): void {
    if (!this.points.length) return;
    if (evt.key === 'ArrowLeft') { this.pinIndex = Math.max(0, (this.pinIndex ?? 0) - 1); evt.preventDefault(); }
    if (evt.key === 'ArrowRight') { this.pinIndex = Math.min(this.points.length - 1, (this.pinIndex ?? -1) + 1); evt.preventDefault(); }
    if (evt.key === 'Escape') { this.pinIndex = null; }
  }
}
