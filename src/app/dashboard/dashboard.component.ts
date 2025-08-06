import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  
  // Dashboard statistics
  policyStats = {
    totalPolicies: 661,
    active: 9,
    inactive: 87,
    rejected: 43
  };

  policyTypes = {
    domain: 50,
    port: 50,
    application: 50
  };

  formatTypes = {
    database: 30,
    application: 25,
    port: 20,
    security: 25
  };

  policyStatus = {
    active: 700,
    inactive: 300,
    pending: 500
  };

  detailedPolicyStatus = {
    trafficInputRate: 50,
    clientHelloReceived: 50,
    httpPacketReceived: 50,
    sslDomainsFound: 50,
    httpDomainsFound: 50,
    domainsMatchedWithPolicy: 50
  };

  additionalPolicyStatus = {
    packetsMatched: 50,
    ipPortPacketsMatched: 50
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    // Temporarily disable auth check for design review
    // if (!this.currentUser) {
    //   this.router.navigate(['/']);
    // }
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (error) => {
        console.error('Logout failed:', error);
        // Force logout even if API call fails
        this.router.navigate(['/']);
      }
    });
  }

  getFormatTypePercentage(type: string): number {
    const total = Object.values(this.formatTypes).reduce((sum, val) => sum + val, 0);
    return Math.round((this.formatTypes[type as keyof typeof this.formatTypes] / total) * 100);
  }

  getPolicyStatusPercentage(status: string): number {
    const total = Object.values(this.policyStatus).reduce((sum, val) => sum + val, 0);
    return Math.round((this.policyStatus[status as keyof typeof this.policyStatus] / total) * 100);
  }
}
