import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-animated-background',
  template: `<canvas #canvas class="animated-canvas"></canvas>`,
  styles: [`
    .animated-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
  `]
})
export class AnimatedBackgroundComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private animationId!: number;
  private particles: Particle[] = [];

  ngOnInit() {
    this.initCanvas();
    this.createParticles();
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  private createParticles() {
    const canvas = this.canvasRef.nativeElement;
    const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
    
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(new Particle(canvas.width, canvas.height));
    }
  }

  private animate() {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    
    // Draw connections
    this.drawConnections();
    
    // Update and draw particles
    this.particles.forEach(particle => {
      particle.update();
      particle.draw(this.ctx);
    });
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private drawConnections() {
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const distance = this.getDistance(this.particles[i], this.particles[j]);
        
        if (distance < 150) {
          const opacity = (150 - distance) / 150 * 0.3;
          this.ctx.strokeStyle = `rgba(0, 191, 255, ${opacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }
  }

  private getDistance(p1: Particle, p2: Particle): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
}

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.size = Math.random() * 2 + 1;
    this.opacity = Math.random() * 0.8 + 0.2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off edges
    if (this.x < 0 || this.x > window.innerWidth) this.vx *= -1;
    if (this.y < 0 || this.y > window.innerHeight) this.vy *= -1;

    // Keep within bounds
    this.x = Math.max(0, Math.min(window.innerWidth, this.x));
    this.y = Math.max(0, Math.min(window.innerHeight, this.y));
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = `rgba(0, 191, 255, ${this.opacity})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}
