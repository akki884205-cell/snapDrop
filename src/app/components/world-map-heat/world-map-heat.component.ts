import { Component, Input, ChangeDetectionStrategy, OnChanges, Output, EventEmitter, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

export interface Hotspot { country: string; value: number; }

interface Point { x: number; y: number; r: number; color: string; label: string; value: number; labelX: number; labelY: number; }

@Component({
  selector: 'app-world-map-heat',
  templateUrl: './world-map-heat.component.html',
  styleUrls: ['./world-map-heat.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorldMapHeatComponent implements OnChanges {
  @Input() data: Hotspot[] = [];
  @Input() ariaLabel = 'World map violation hotspots';
  @Input() highlightCountry: string | null = null;
  @Output() selectCountry = new EventEmitter<string>();
  width = 600;
  height = 300;
  points: Point[] = [];

  private coords: Record<string, { lat: number; lon: number }> = {
    US: { lat: 37.5, lon: -96 }, CA: { lat: 56, lon: -106 }, MX: { lat: 23, lon: -102 },
    BR: { lat: -14, lon: -51 }, AR: { lat: -34, lon: -64 }, GB: { lat: 55, lon: -3 },
    FR: { lat: 46, lon: 2 }, DE: { lat: 51, lon: 10 }, ES: { lat: 40, lon: -3 }, IT: { lat: 42.5, lon: 12.5 },
    RU: { lat: 61, lon: 105 }, IN: { lat: 21, lon: 78 }, CN: { lat: 35, lon: 103 }, JP: { lat: 36, lon: 138 },
    KR: { lat: 36, lon: 128 }, SG: { lat: 1.35, lon: 103.8 }, AU: { lat: -25, lon: 133 }, ZA: { lat: -30, lon: 25 },
    AE: { lat: 24, lon: 54 }, NL: { lat: 52.3, lon: 5.5 }, SE: { lat: 62, lon: 15 },
  };

  ngOnChanges(): void {
    const max = Math.max(...this.data.map(d => d.value), 1);
    this.points = this.data
      .filter(d => !!this.coords[d.country])
      .map(d => {
        const { lat, lon } = this.coords[d.country];
        const x = this.projectX(lon);
        const y = this.projectY(lat);
        const r = 4 + (d.value / max) * 10;
        const color = this.mix('#ffcccc', '#ff4757', d.value / max);
        return { x, y, r, color, label: d.country, value: d.value, labelX: 0, labelY: 0 };
      });

    this.separateBubbles(3, 2); // small spacing, few iterations to keep geo fidelity
    this.placeLabels();
  }

  private separateBubbles(margin: number, iterations: number): void {
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < this.points.length; i++) {
        for (let j = i + 1; j < this.points.length; j++) {
          const a = this.points[i];
          const b = this.points[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 0.0001;
          const minDist = a.r + b.r + margin;
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * overlap;
            a.y -= uy * overlap;
            b.x += ux * overlap;
            b.y += uy * overlap;
            a.x = Math.max(0, Math.min(this.width, a.x));
            a.y = Math.max(0, Math.min(this.height, a.y));
            b.x = Math.max(0, Math.min(this.width, b.x));
            b.y = Math.max(0, Math.min(this.height, b.y));
          }
        }
      }
    }
  }

  private placeLabels(): void {
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    const charW = 6; // approx px per char
    const lineH = 12; // px

    this.points.forEach(p => {
      // initial label point to the right of bubble
      let lx = p.x + p.r + 6;
      let ly = p.y + 4;
      const w = (p.label.length + 6) * charW; // include value
      const h = lineH;

      // avoid overlaps by nudging down until free or reaching bounds, then up
      let attempts = 0;
      const maxAttempts = 40;
      while (attempts < maxAttempts && boxes.some(b => this.overlaps(lx, ly - h + 2, w, h, b.x, b.y - b.h + 2, b.w, b.h))) {
        ly += lineH; // nudge down
        if (ly > this.height - 4) {
          // reset near bubble but above
          ly = Math.max(12, p.y - (attempts * 2));
          lx = p.x + p.r + 6;
        }
        attempts++;
      }

      boxes.push({ x: lx, y: ly, w, h });
      p.labelX = lx;
      p.labelY = ly;
    });
  }

  private overlaps(x1:number,y1:number,w1:number,h1:number, x2:number,y2:number,w2:number,h2:number): boolean {
    return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 < y2 - h2 || y2 < y1 - h1);
  }

  private projectX(lon: number): number {
    return ((lon + 180) / 360) * this.width;
  }
  private projectY(lat: number): number {
    const y = (1 - Math.log(Math.tan((Math.PI/4) + (lat * Math.PI/180)/2)) / Math.PI) / 2;
    return y * this.height;
  }

  private mix(c1: string, c2: string, t: number): string {
    const a = this.hexToRgb(c1), b = this.hexToRgb(c2);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const b2 = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r}, ${g}, ${b2})`;
  }

  private hexToRgb(hex: string) {
    const v = hex.replace('#','');
    return { r: parseInt(v.substring(0,2),16), g: parseInt(v.substring(2,4),16), b: parseInt(v.substring(4,6),16) };
  }

  onBubbleClick(country: string): void {
    this.selectCountry.emit(country);
  }
}
