import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export interface PieDatum { label: string; value: number; color?: string; }

@Component({
  selector: 'app-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PieChartComponent {
  @Input() data: PieDatum[] = [];
  @Input() ariaLabel = 'Pie chart';
  size = 220;
  radius = 100;

  get total(): number { return this.data.reduce((s, d) => s + d.value, 0) || 1; }

  get arcs() {
    const arcs: { d: string; color: string; label: string; value: number }[] = [];
    let angle = -Math.PI / 2; // start at top
    this.data.forEach((d, i) => {
      const frac = d.value / this.total;
      const theta = frac * Math.PI * 2;
      const large = theta > Math.PI ? 1 : 0;
      const x0 = this.radius * Math.cos(angle);
      const y0 = this.radius * Math.sin(angle);
      const x1 = this.radius * Math.cos(angle + theta);
      const y1 = this.radius * Math.sin(angle + theta);
      const path = `M 0 0 L ${x0} ${y0} A ${this.radius} ${this.radius} 0 ${large} 1 ${x1} ${y1} Z`;
      arcs.push({ d: path, color: d.color || this.palette(i), label: d.label, value: d.value });
      angle += theta;
    });
    return arcs;
  }

  palette(i: number): string {
    const colors = ['#4FC3F7','#2ecc71','#ff4757','#f39c12','#9b59b6','#16a085','#e67e22','#e74c3c','#3498db','#95a5a6'];
    return colors[i % colors.length];
  }
}
