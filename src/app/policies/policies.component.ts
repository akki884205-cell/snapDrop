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
  toggleActive: boolean;
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
  showSuccessMessage: boolean = false;
  showCreateModal: boolean = false;
  showUploadModal: boolean = false;
  selectedFile: File | null = null;
  showActionDropdown: number | null = null;

  newPolicy = {
    name: '',
    type: 'Domain',
    description: '',
    autoRefresh: false,
    applyPolicy: false
  };
  
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
      toggleActive: true,
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
      toggleActive: false,
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
      toggleActive: false,
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
    this.showSuccessMessage = true;
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 3000);
    console.log('Add new policy clicked');
  }

  onCreateNew(): void {
    this.showCreateModal = true;
  }

  onUploadFile(): void {
    this.showUploadModal = true;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'Failed': return 'status-failed';
      case 'In Progress': return 'status-progress';
      default: return '';
    }
  }

  getStatusIndicatorClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'indicator-completed';
      case 'Failed': return 'indicator-failed';
      case 'In Progress': return 'indicator-progress';
      default: return '';
    }
  }

  hideSuccessMessage(): void {
    this.showSuccessMessage = false;
  }

  onTogglePolicy(policyIndex: number): void {
    this.filteredPolicies[policyIndex].toggleActive = !this.filteredPolicies[policyIndex].toggleActive;
  }

  onCancelModal(): void {
    this.showCreateModal = false;
    this.resetForm();
  }

  onAddPolicy(): void {
    // Add the new policy to the list
    const newPolicyId = (this.policies.length + 1).toString().padStart(6, '0');
    const newPolicy: Policy = {
      id: newPolicyId,
      name: this.newPolicy.name || 'New Policy',
      type: this.newPolicy.type,
      filters: 'Label',
      target: 'Label',
      lastUpdated: new Date().toLocaleString(),
      creationTime: 'Label',
      actions: 'Label',
      toggleActive: this.newPolicy.applyPolicy,
      status: 'In Progress'
    };

    this.policies.push(newPolicy);
    this.filterPolicies();
    this.showCreateModal = false;
    this.showSuccessMessage = true;
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 3000);
    this.resetForm();
  }

  private resetForm(): void {
    this.newPolicy = {
      name: '',
      type: 'Domain',
      description: '',
      autoRefresh: false,
      applyPolicy: false
    };
  }

  onCancelUpload(): void {
    this.showUploadModal = false;
    this.selectedFile = null;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  onUploadFileSubmit(): void {
    if (this.selectedFile) {
      // Process the uploaded file
      console.log('Uploading file:', this.selectedFile.name);
      this.showUploadModal = false;
      this.showSuccessMessage = true;
      setTimeout(() => {
        this.showSuccessMessage = false;
      }, 3000);
      this.selectedFile = null;
    }
  }

  onDownloadTemplate(): void {
    console.log('Downloading upload format template');
  }

  toggleActionDropdown(index: number): void {
    this.showActionDropdown = this.showActionDropdown === index ? null : index;
  }

  onEditPolicy(policy: Policy, index: number): void {
    console.log('Edit policy:', policy);
    this.showActionDropdown = null;
    // Add edit logic here
  }

  onDeletePolicy(policy: Policy, index: number): void {
    console.log('Delete policy:', policy);
    // Remove policy from array
    const policyIndex = this.policies.findIndex(p => p.id === policy.id);
    if (policyIndex > -1) {
      this.policies.splice(policyIndex, 1);
      this.filterPolicies();
    }
    this.showActionDropdown = null;
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
