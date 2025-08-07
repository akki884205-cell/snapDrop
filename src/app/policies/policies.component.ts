import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
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

  // Pagination properties
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;
  pageSizeOptions: number[] = [10, 25, 50, 100];
  displayedPolicies: Policy[] = [];
  showPageSizeDropdown: boolean = false;

  // Sorting properties
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' | '' = '';
  sortableColumns = [
    { key: 'id', label: 'Policy ID' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'filters', label: 'Filters' },
    { key: 'target', label: 'Target' },
    { key: 'lastUpdated', label: 'Last Updated' },
    { key: 'creationTime', label: 'Creation Time' },
    { key: 'status', label: 'Status' }
  ];

  // Reactive Form
  policyForm!: FormGroup;

  // Application autocomplete
  applicationOptions: string[] = [];
  filteredApplications: string[] = [];

  // Mock applications for autocomplete
  private mockApplications = [
    'Chrome Browser', 'Firefox Browser', 'Microsoft Edge', 'Safari Browser',
    'WhatsApp', 'Telegram', 'Discord', 'Slack', 'Microsoft Teams',
    'Netflix', 'YouTube', 'Spotify', 'Amazon Prime', 'Disney Plus',
    'Microsoft Office', 'Adobe Photoshop', 'Visual Studio Code', 'IntelliJ IDEA',
    'Zoom', 'Google Meet', 'Skype', 'WebEx'
  ];
  
  policies: Policy[] = this.generateSamplePolicies(125);

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
    private router: Router,
    private formBuilder: FormBuilder
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/']);
    }
    this.filteredPolicies = [...this.policies];
    this.updatePagination();
  }

  private generateSamplePolicies(count: number): Policy[] {
    const policies: Policy[] = [];
    const types = ['Domain', 'IP Port', 'Application'];
    const statuses: ('COMPLETED' | 'Failed' | 'In Progress')[] = ['COMPLETED', 'Failed', 'In Progress'];

    for (let i = 1; i <= count; i++) {
      policies.push({
        id: i.toString().padStart(6, '0'),
        name: `Policy ${i}`,
        type: types[i % types.length],
        filters: `Filter ${i}`,
        target: `Target ${i}`,
        lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        creationTime: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        actions: 'Label',
        toggleActive: Math.random() > 0.5,
        status: statuses[i % statuses.length]
      });
    }
    return policies;
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

    // Apply current sorting if any
    this.applySorting();

    // Reset to first page when filtering
    this.currentPage = 1;
    this.updatePagination();
  }

  // Pagination methods
  private updatePagination(): void {
    this.totalItems = this.filteredPolicies.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    // Ensure current page is within bounds
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }

    this.updateDisplayedPolicies();
  }

  private updateDisplayedPolicies(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.displayedPolicies = this.filteredPolicies.slice(startIndex, endIndex);
  }

  onPageSizeChange(newPageSize: number): void {
    this.pageSize = newPageSize;
    this.currentPage = 1;
    this.showPageSizeDropdown = false;
    this.updatePagination();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateDisplayedPolicies();
    }
  }

  onPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplayedPolicies();
    }
  }

  onNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateDisplayedPolicies();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 6; // Show maximum 6 page numbers

    if (this.totalPages <= maxPages) {
      // Show all pages if total pages is less than max
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let start = Math.max(1, this.currentPage - 2);
      let end = Math.min(this.totalPages, start + maxPages - 1);

      // Adjust start if we're near the end
      if (end - start < maxPages - 1) {
        start = Math.max(1, end - maxPages + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  getShowingText(): string {
    if (this.totalItems === 0) {
      return 'Showing 0 to 0 of 0 entries';
    }

    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalItems);

    return `Showing ${start} to ${end} of ${this.totalItems} entries`;
  }

  togglePageSizeDropdown(): void {
    this.showPageSizeDropdown = !this.showPageSizeDropdown;
  }

  // Sorting methods
  onSort(column: string): void {
    if (this.sortColumn === column) {
      // Toggle sort direction
      if (this.sortDirection === 'asc') {
        this.sortDirection = 'desc';
      } else if (this.sortDirection === 'desc') {
        this.sortDirection = '';
        this.sortColumn = '';
      } else {
        this.sortDirection = 'asc';
      }
    } else {
      // New column
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applySorting();
    this.currentPage = 1; // Reset to first page when sorting
    this.updatePagination();
  }

  private applySorting(): void {
    if (!this.sortColumn || !this.sortDirection) {
      // No sorting, use original order
      this.filteredPolicies = [...this.policies.filter(policy => this.matchesSearch(policy))];
      return;
    }

    this.filteredPolicies.sort((a, b) => {
      let aValue = this.getSortValue(a, this.sortColumn);
      let bValue = this.getSortValue(b, this.sortColumn);

      // Handle different data types
      if (this.sortColumn === 'lastUpdated' || this.sortColumn === 'creationTime') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (this.sortColumn === 'id') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      if (aValue < bValue) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private getSortValue(policy: Policy, column: string): any {
    switch (column) {
      case 'id': return policy.id;
      case 'name': return policy.name;
      case 'type': return policy.type;
      case 'filters': return policy.filters;
      case 'target': return policy.target;
      case 'lastUpdated': return policy.lastUpdated;
      case 'creationTime': return policy.creationTime;
      case 'status': return policy.status;
      default: return '';
    }
  }

  private matchesSearch(policy: Policy): boolean {
    if (!this.searchTerm) return true;

    return Object.values(policy).some(value =>
      value.toString().toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'sort-none';
    }

    if (this.sortDirection === 'asc') {
      return 'sort-asc';
    } else if (this.sortDirection === 'desc') {
      return 'sort-desc';
    }

    return 'sort-none';
  }

  // Form initialization and validation
  private initializeForm(): void {
    this.policyForm = this.formBuilder.group({
      name: ['', [Validators.required, this.noWhitespaceValidator]],
      type: ['domain', [Validators.required]],
      domain: [''],
      ip: [''],
      port: [''],
      application: [''],
      applyPolicy: [false]
    });

    // Subscribe to type changes to update validation dynamically
    this.policyForm.get('type')?.valueChanges.subscribe(type => {
      this.updateValidationForType(type);
    });

    // Set initial validation for default type
    this.updateValidationForType('domain');
  }

  private updateValidationForType(type: string): void {
    const domainControl = this.policyForm.get('domain');
    const ipControl = this.policyForm.get('ip');
    const portControl = this.policyForm.get('port');
    const applicationControl = this.policyForm.get('application');

    // Clear all validators first
    domainControl?.clearValidators();
    ipControl?.clearValidators();
    portControl?.clearValidators();
    applicationControl?.clearValidators();

    // Reset values for unused fields
    if (type !== 'domain') {
      domainControl?.setValue('');
    }
    if (type !== 'ipport') {
      ipControl?.setValue('');
      portControl?.setValue('');
    }
    if (type !== 'application') {
      applicationControl?.setValue('');
    }

    // Set validators based on type
    switch (type) {
      case 'domain':
        domainControl?.setValidators([
          Validators.required,
          this.noWhitespaceValidator,
          this.domainValidator
        ]);
        break;
      case 'ipport':
        ipControl?.setValidators([
          Validators.required,
          this.noWhitespaceValidator,
          this.ipValidator
        ]);
        portControl?.setValidators([this.portValidator]);
        break;
      case 'application':
        applicationControl?.setValidators([
          Validators.required,
          this.applicationValidator
        ]);
        break;
    }

    // Update validity
    domainControl?.updateValueAndValidity();
    ipControl?.updateValueAndValidity();
    portControl?.updateValueAndValidity();
    applicationControl?.updateValueAndValidity();
  }

  // Custom Validators
  private noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const isWhitespace = (control.value || '').trim().length === 0;
    return isWhitespace ? { whitespace: true } : null;
  }

  private domainValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const isValid = domainRegex.test(control.value.trim());

    return isValid ? null : { invalidDomain: true };
  }

  private ipValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const value = control.value.trim();

    // Check for CIDR notation
    if (value.includes('/')) {
      return this.validateCIDR(value);
    }

    // Check for IPv4 or IPv6
    return this.validateIP(value);
  }

  private validateIP(ip: string): ValidationErrors | null {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return null;
    }

    return { invalidIP: true };
  }

  private validateCIDR(cidr: string): ValidationErrors | null {
    const parts = cidr.split('/');
    if (parts.length !== 2) {
      return { invalidCIDR: true };
    }

    const [ip, prefix] = parts;
    const prefixNum = parseInt(prefix, 10);

    // Validate IP part
    const ipValidation = this.validateIP(ip);
    if (ipValidation) {
      return { invalidCIDR: true };
    }

    // Validate prefix
    const isIPv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
    const maxPrefix = isIPv4 ? 32 : 128;

    if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > maxPrefix) {
      return { invalidCIDR: true };
    }

    return null;
  }

  private portValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null; // Port is optional

    const portNum = parseInt(control.value, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return { invalidPort: true };
    }

    return null;
  }

  private applicationValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const isValid = this.mockApplications.includes(control.value);
    return isValid ? null : { invalidApplication: true };
  }

  // Application autocomplete methods
  onApplicationSearch(searchTerm: string): void {
    if (!searchTerm || searchTerm.length < 2) {
      this.filteredApplications = [];
      return;
    }

    // Simulate API call with debouncing
    this.filteredApplications = this.mockApplications
      .filter(app => app.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 8); // Limit to 8 results
  }

  onApplicationSelect(application: string): void {
    this.policyForm.get('application')?.setValue(application);
    this.filteredApplications = [];
  }

  // Getters for template
  get currentPolicyType(): string {
    return this.policyForm.get('type')?.value || 'domain';
  }

  get isFormValid(): boolean {
    return this.policyForm.valid;
  }

  // Error message getters
  getFieldError(fieldName: string): string {
    const field = this.policyForm.get(fieldName);
    if (!field || !field.touched || !field.errors) {
      return '';
    }

    const errors = field.errors;

    if (errors['required']) {
      return `${this.getFieldDisplayName(fieldName)} is required`;
    }
    if (errors['whitespace']) {
      return `${this.getFieldDisplayName(fieldName)} cannot be empty`;
    }
    if (errors['invalidDomain']) {
      return 'Please enter a valid domain name';
    }
    if (errors['invalidIP']) {
      return 'Please enter a valid IPv4/IPv6 address';
    }
    if (errors['invalidCIDR']) {
      return 'Please enter a valid CIDR notation';
    }
    if (errors['invalidPort']) {
      return 'Port must be between 1 and 65535';
    }
    if (errors['invalidApplication']) {
      return 'Please select a valid application';
    }

    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      name: 'Name',
      domain: 'Domain',
      ip: 'IP Address',
      port: 'Port',
      application: 'Application'
    };
    return displayNames[fieldName] || fieldName;
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
    const actualIndex = (this.currentPage - 1) * this.pageSize + policyIndex;
    if (actualIndex < this.filteredPolicies.length) {
      this.filteredPolicies[actualIndex].toggleActive = !this.filteredPolicies[actualIndex].toggleActive;
    }
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
    this.filteredPolicies = [...this.policies];
    this.updatePagination();
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    this.showActionDropdown = null;
    this.showPageSizeDropdown = false;
  }

  toggleActionDropdown(index: number): void {
    this.showActionDropdown = this.showActionDropdown === index ? null : index;
    console.log('Toggle dropdown for index:', index, 'Current:', this.showActionDropdown);
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
      this.filteredPolicies = this.filteredPolicies.filter(p => p.id !== policy.id);
      this.updatePagination();
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
