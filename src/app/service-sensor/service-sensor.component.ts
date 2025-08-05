import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';

@Component({
  selector: 'app-service-sensor',
  templateUrl: './service-sensor.component.html',
  styleUrls: ['./service-sensor.component.css']
})
export class ServiceSensorComponent implements OnInit {
  currentUser: User | null = null;

  // Sample data for charts
  cpuData = [
    { time: '3:43:01 PM', value: 65 },
    { time: '3:43:02 PM', value: 70 },
    { time: '3:43:03 PM', value: 60 },
    { time: '3:43:04 PM', value: 80 },
    { time: '3:43:05 PM', value: 75 }
  ];

  ramData = [
    { time: '3:43:01 PM', value: 45 },
    { time: '3:43:02 PM', value: 50 },
    { time: '3:43:03 PM', value: 40 },
    { time: '3:43:04 PM', value: 65 },
    { time: '3:43:05 PM', value: 55 }
  ];

  activeServices = {
    noOfFiles: 'Nil of files',
    statusActive: 'Status Active',
    cpuValue: '0%',
    ramValue: '56%'
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/']);
    }
  }

  onBackToDashboard(): void {
    this.router.navigate(['/dashboard']);
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
}
