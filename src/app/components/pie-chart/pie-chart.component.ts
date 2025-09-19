import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

export interface PieDatum { label: string; value: number; color?: string; }

@Component({
  selector: 'app-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PieChartComponent implements AfterViewInit, OnDestroy {
  @Input() data: PieDatum[] = [];
  @Input() ariaLabel = 'Pie chart';
  @Input() selectedLabel: string | null = null;
  @Output() selectSlice = new EventEmitter<string>();

  size = 240;
  radius = 100;
  innerRadius = 58;
  private ro?: ResizeObserver;
  constructor(private el: ElementRef<HTMLElement>) {}

  get total(): number { return this.data.reduce((s, d) => s + d.value, 0) || 1; }

  // Donut arcs with simple 3D underlay
  get arcs() {
    const arcs: { outer: string; inner: string; under?: string; color: string; label: string; value: number; midAngle: number; selected: boolean }[] = [];
    let angle = -Math.PI / 2; // start at top
    this.data.forEach((d, i) => {
      const frac = d.value / this.total;
      const theta = frac * Math.PI * 2;
      const large = theta > Math.PI ? 1 : 0;
      const a0 = angle;
      const a1 = angle + theta;
      const x0 = this.radius * Math.cos(a0);
      const y0 = this.radius * Math.sin(a0);
      const x1 = this.radius * Math.cos(a1);
      const y1 = this.radius * Math.sin(a1);
      const xi0 = this.innerRadius * Math.cos(a0);
      const yi0 = this.innerRadius * Math.sin(a0);
      const xi1 = this.innerRadius * Math.cos(a1);
      const yi1 = this.innerRadius * Math.sin(a1);

      const outer = `M ${x0} ${y0} A ${this.radius} ${this.radius} 0 ${large} 1 ${x1} ${y1}`;
      const inner = `L ${xi1} ${yi1} A ${this.innerRadius} ${this.innerRadius} 0 ${large} 0 ${xi0} ${yi0} Z`;
      const under = `M ${x0} ${y0 + 4} A ${this.radius} ${this.radius} 0 ${large} 1 ${x1} ${y1 + 4} L ${xi1} ${yi1 + 4} A ${this.innerRadius} ${this.innerRadius} 0 ${large} 0 ${xi0} ${yi0 + 4} Z`;
      const color = d.color || this.palette(i);
      const midAngle = a0 + theta / 2;
      const selected = this.selectedLabel === d.label;
      arcs.push({ outer, inner, under, color, label: d.label, value: d.value, midAngle, selected });
      angle += theta;
    });
    return arcs;
  }

  onSliceClick(label: string) { this.selectSlice.emit(label); }

  ngAfterViewInit(): void {
    const update = () => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const s = Math.max(200, Math.min(360, Math.floor(rect.width)));
      this.size = s;
      this.radius = Math.round(s * 0.42);
      this.innerRadius = Math.round(this.radius * 0.58);
    };
    update();
    this.ro = new ResizeObserver(() => update());
    this.ro.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void { if (this.ro) { this.ro.disconnect(); this.ro = undefined; } }

  palette(i: number): string {
    const colors = ['#4FC3F7','#2ecc71','#ff4757','#f39c12','#9b59b6','#16a085','#e67e22','#e74c3c','#3498db','#95a5a6'];
    return colors[i % colors.length];
  }
}
