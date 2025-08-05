import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';

export interface Policy {
  id: string;
  name: string;
  type: string;
  filters: string;
  target: string;
  lastUpdated: string;
  creationTime: string;
  actions: string;
  status: 'COMPLETED' | 'Failed' | 'In Progress';
}

@Component({
  selector: 'app-policies',
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.css']
})
export class PoliciesComponent implements OnInit {
  currentUser: User | null = null;
  searchTerm: string = '';
  selectedFilters: string[] = [];
  
  policies: Policy[] = [
    {
      id: '888888',
      name: 'abcdef',
      type: 'Application',
      filters: 'Label',
      target: 'Label',
      lastUpdated: 'Sep 28, 8888, 12:56:58 PM',
      creationTime: 'Label',
      actions: 'Label',
      status: 'COMPLETED'
    },
    {
      id: '888888',
      name: 'abcdef',
      type: 'Application',
      filters: 'Label',
      target: 'Label',
      lastUpdated: 'Sep 28, 8888, 12:56:58 PM',
      creationTime: 'Label',
      actions: 'Label',
      status: 'Failed'
    },
    {
      id: '888888',
      name: 'abcdef',
      type: 'Application',
      filters: 'Label',
      target: 'Label',
      lastUpdated: 'Sep 28, 8888, 12:56:58 PM',
      creationTime: 'Label',
      actions: 'Label',
      status: 'In Progress'
    }
  ];

  filteredPolicies: Policy[] = [];
  
  filterOptions = [
    { label: 'Policy ID', value: 'policyId' },
    { label: 'Name', value: 'name' },
    { label: 'Type', value: 'type' },
    { label: 'Filters', value: 'filters' },
    { label: 'Target', value: 'target' },
    { label: 'Last Updated', value: 'lastUpdated' },
    { label: 'Creation Time', value: 'creationTime' },
    { label: 'Actions/Checkboxes', value: 'actions' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/']);
    }
    this.filteredPolicies = [...this.policies];
  }

  onSearch(): void {
    this.filterPolicies();
  }

  onFilterChange(filterValue: string, checked: boolean): void {
    if (checked) {
      this.selectedFilters.push(filterValue);
    } else {
      this.selectedFilters = this.selectedFilters.filter(f => f !== filterValue);
    }
    this.filterPolicies();
  }

  private filterPolicies(): void {
    this.filteredPolicies = this.policies.filter(policy => {
      const matchesSearch = !this.searchTerm || 
        Object.values(policy).some(value => 
          value.toString().toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      
      const matchesFilters = this.selectedFilters.length === 0 || 
        this.selectedFilters.some(filter => {
          switch (filter) {
            case 'policyId': return policy.id.toLowerCase().includes(this.searchTerm.toLowerCase());
            case 'name': return policy.name.toLowerCase().includes(this.searchTerm.toLowerCase());
            case 'type': return policy.type.toLowerCase().includes(this.searchTerm.toLowerCase());
            default: return true;
          }
        });
      
      return matchesSearch && (this.selectedFilters.length === 0 || matchesFilters);
    });
  }

  onAddNewPolicy(): void {
    // Handle add new policy
    console.log('Add new policy clicked');
  }

  onCreateNew(): void {
    // Handle create new
    console.log('Create new clicked');
  }

  onUploadFile(): void {
    // Handle upload file
    console.log('Upload file clicked');
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'Failed': return 'status-failed';
      case 'In Progress': return 'status-progress';
      default: return '';
    }
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
