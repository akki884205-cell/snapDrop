import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, of, Observable } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
  status: string;
}

export interface PolicyCreateRequest {
  filterName: string;
  filterType: string;
  filterValue: string;
  filterPid: string;
  domainIpValue: string;
  filterStatus: string;
  netifyFilter: boolean;
}

export interface PolicyCreateResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface PolicyApiItem {
  id: number;
  filterName: string;
  filterType: string;
  filterValue: string;
  sourceType: string;
  filterPid: string;
  filterStatus: string;
  userUpdatedStatus: string;
  creationTime: number;
  updationTime: number;
  probeProvisionedTime: number | null;
  domainIpValue: string;
  ready: boolean;
  netifyFilter: boolean;
  activated: boolean;
  deleted: boolean;
}

export interface PolicyListResponse {
  content: PolicyApiItem[];
  pageable?: any;
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
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

  // API configuration
  private apiUrl = 'http://172.50.34.107:9089/api/filter-management';
  private uploadApiUrl = 'http://172.50.34.107:9089/api/filter-management/upload';
  private listApiUrl = 'http://172.50.34.107:9089/api/filter-management';

  // Loading and submission states
  isSubmitting: boolean = false;
  submitError: string = '';
  submitSuccess: string = '';

  // File upload states
  isUploading: boolean = false;
  uploadError: string = '';
  uploadSuccess: string = '';

  // Policy list loading states
  isLoadingPolicies: boolean = false;
  policiesError: string = '';

  // File validation constants
  private readonly ACCEPTED_FILE_TYPES = ['.csv'];
  private readonly MIN_FILE_SIZE = 1 * 1024; // 1 KB
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  // Mock applications for autocomplete
  private mockApplications = [
    'Chrome Browser', 'Firefox Browser', 'Microsoft Edge', 'Safari Browser',
    'WhatsApp', 'Telegram', 'Discord', 'Slack', 'Microsoft Teams',
    'Netflix', 'YouTube', 'Spotify', 'Amazon Prime', 'Disney Plus',
    'Microsoft Office', 'Adobe Photoshop', 'Visual Studio Code', 'IntelliJ IDEA',
    'Zoom', 'Google Meet', 'Skype', 'WebEx'
  ];
  
  policies: Policy[] = [];

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
    private formBuilder: FormBuilder,
    private http: HttpClient
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/']);
      return;
    }
    this.loadPolicies();
  }

  private loadPolicies(): void {
    this.isLoadingPolicies = true;
    this.policiesError = '';

    this.fetchPolicies(this.currentPage - 1, this.pageSize).subscribe({
      next: (response) => {
        this.isLoadingPolicies = false;
        this.policies = this.mapApiPoliciesToLocalPolicies(response.content);
        this.filteredPolicies = [...this.policies];

        // Update pagination based on API response
        if (response.totalElements !== undefined) {
          this.totalItems = response.totalElements;
          this.totalPages = response.totalPages || Math.ceil(this.totalItems / this.pageSize);
        } else {
          this.totalItems = this.policies.length;
          this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        }

        this.updateDisplayedPolicies();
      },
      error: (error) => {
        this.isLoadingPolicies = false;
        this.policiesError = this.getErrorMessage(error);
        console.error('Failed to load policies:', error);
      }
    });
  }

  private fetchPolicies(page: number, size: number): Observable<PolicyListResponse> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'accept': '*/*'
    });

    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    console.log('Fetching policies from:', this.listApiUrl, 'with params:', { page, size });

    return this.http.get<PolicyListResponse>(this.listApiUrl, { headers, params });
  }

  private mapApiPoliciesToLocalPolicies(apiPolicies: PolicyApiItem[]): Policy[] {
    return apiPolicies.map(apiPolicy => ({
      id: apiPolicy.id.toString(),
      name: apiPolicy.filterName,
      type: apiPolicy.filterType,
      filters: 'Auto-generated', // Not provided in API response
      target: apiPolicy.domainIpValue || apiPolicy.filterValue,
      lastUpdated: apiPolicy.probeProvisionedTime ?
        new Date(apiPolicy.probeProvisionedTime).toLocaleDateString() :
        new Date(apiPolicy.updationTime).toLocaleDateString(),
      creationTime: new Date(apiPolicy.creationTime).toLocaleDateString(),
      actions: 'Label',
      toggleActive: this.getToggleActiveStatus(apiPolicy.filterStatus),
      status: apiPolicy.filterStatus
    }));
  }

  private getToggleActiveStatus(filterStatus: string): boolean {
    // Return true if active, false if rejected, and handle inactive/in progress specially
    switch (filterStatus.toLowerCase()) {
      case 'active':
      case 'activated':
        return true;
      case 'rejected':
      case 'failed':
        return false;
      case 'inactive':
      case 'in progress':
      case 'pending':
      default:
        return false; // Will be handled with greyed out styling
    }
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

    // Update displayed policies (we're handling pagination via API now, so just display all filtered)
    this.updateDisplayedPolicies();
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
    this.loadPolicies(); // Reload from API with new page size
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPolicies(); // Reload from API with new page
    }
  }

  onPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPolicies(); // Reload from API
    }
  }

  onNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadPolicies(); // Reload from API
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
      type: ['Domain', [Validators.required]],
      domain: [''],
      ip: [''],
      port: [''],
      application: [''],
      activatePolicy: [false]
    });

    // Subscribe to type changes to update validation dynamically
    this.policyForm.get('type')?.valueChanges.subscribe(type => {
      this.updateValidationForType(type);
    });

    // Set initial validation for default type
    this.updateValidationForType('Domain');
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
    if (type !== 'Domain') {
      domainControl?.setValue('');
    }
    if (type !== 'IP' && type !== 'IP-Port') {
      ipControl?.setValue('');
      portControl?.setValue('');
    }
    if (type !== 'Application') {
      applicationControl?.setValue('');
    }

    // Set validators based on type
    switch (type) {
      case 'Domain':
        domainControl?.setValidators([
          Validators.required,
          this.noWhitespaceValidator,
          this.domainValidator
        ]);
        break;
      case 'IP':
      case 'IP-Port':
        ipControl?.setValidators([
          Validators.required,
          this.noWhitespaceValidator,
          this.ipValidator
        ]);
        if (type === 'IP-Port') {
          portControl?.setValidators([this.portValidator]);
        }
        break;
      case 'Application':
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

  // Custom Validators - using arrow functions to preserve 'this' context
  private noWhitespaceValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const isWhitespace = (control.value || '').trim().length === 0;
    return isWhitespace ? { whitespace: true } : null;
  }

  private domainValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const isValid = domainRegex.test(control.value.trim());

    return isValid ? null : { invalidDomain: true };
  }

  private ipValidator = (control: AbstractControl): ValidationErrors | null => {
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

  private portValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null; // Port is optional

    const portNum = parseInt(control.value, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return { invalidPort: true };
    }

    return null;
  }

  private applicationValidator = (control: AbstractControl): ValidationErrors | null => {
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
    return this.policyForm.get('type')?.value || 'Domain';
  }

  get isFormValid(): boolean {
    return this.policyForm.valid;
  }

  get isUploadEnabled(): boolean {
    return !!(this.selectedFile && !this.isUploading && !this.uploadError);
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
    if (this.isSubmitting) {
      return; // Prevent closing modal during submission
    }
    this.showCreateModal = false;
    this.resetForm();
  }

  onAddPolicy(): void {
    if (!this.policyForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.submitSuccess = '';

    const formValue = this.policyForm.value;
    const payload = this.createApiPayload(formValue);

    console.log('Form values:', formValue);
    console.log('API payload:', payload);
    console.log('API endpoint:', this.apiUrl);

    this.createPolicy(payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.submitSuccess = 'Policy created successfully!';

        // Reload policies from API to get updated list
        this.loadPolicies();

        // Close modal and reset form
        this.showCreateModal = false;
        this.resetForm();

        // Show success message
        this.showSuccessMessage = true;
        setTimeout(() => {
          this.showSuccessMessage = false;
          this.submitSuccess = '';
        }, 3000);
      },
      error: (error) => {
        this.isSubmitting = false;
        console.error('Policy creation failed - Full error:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        console.error('Error body:', error.error);

        this.submitError = this.getErrorMessage(error);
        console.log('Formatted error message:', this.submitError);
      }
    });
  }

  private createApiPayload(formValue: any): PolicyCreateRequest {
    let filterValue = '';
    let filterType = '';

    // Map form type to API type
    switch (formValue.type) {
      case 'Domain':
        filterType = 'Domain';
        filterValue = formValue.domain;
        break;
      case 'IP':
        filterType = 'IP';
        filterValue = formValue.ip;
        break;
      case 'IP-Port':
        filterType = 'IP-Port';
        filterValue = formValue.port ? `${formValue.ip};${formValue.port}` : formValue.ip;
        break;
      case 'Application':
        filterType = 'Application';
        filterValue = formValue.application;
        break;
    }

    return {
      filterName: formValue.name,
      filterType: filterType,
      filterValue: filterValue,
      filterPid: '',
      domainIpValue: '',
      filterStatus: formValue.activatePolicy ? 'ACTIVE' : 'INACTIVE',
      netifyFilter: true
    };
  }

  private createPolicy(payload: PolicyCreateRequest): Observable<PolicyCreateResponse> {
    const token = this.authService.getAuthToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': '*/*'
    });

    return this.http.post<PolicyCreateResponse>(this.apiUrl, payload, { headers });
  }


  private getErrorMessage(error: any): string {
    console.error('Full error object:', error);

    // Check for HTTP error response
    if (error.error) {
      // If error.error is a string
      if (typeof error.error === 'string') {
        return error.error;
      }

      // If error.error has message property
      if (error.error.message) {
        return error.error.message;
      }

      // If error.error has other properties, try to extract meaningful info
      if (error.error.error) {
        return error.error.error;
      }

      // Try to stringify the error object
      try {
        return JSON.stringify(error.error);
      } catch (e) {
        // If stringification fails, fall through to other checks
      }
    }

    // Check for direct message
    if (error.message) {
      return error.message;
    }

    // Check for specific HTTP status codes
    if (error.status === 0) {
      return 'Network error. Please check your connection and try again.';
    }
    if (error.status === 401) {
      return 'Authentication failed. Please login again.';
    }
    if (error.status === 403) {
      return 'Access denied. You do not have permission to create policies.';
    }
    if (error.status === 404) {
      return 'API endpoint not found. Please check the server configuration.';
    }
    if (error.status === 422) {
      return 'Invalid data provided. Please check your input and try again.';
    }
    if (error.status === 500) {
      return 'Server error. Please try again later.';
    }

    // If all else fails, try to extract any meaningful text from the error
    if (error.statusText && error.statusText !== 'Unknown Error') {
      return `Error ${error.status}: ${error.statusText}`;
    }

    // Last resort - return a generic message with status if available
    if (error.status) {
      return `Request failed with status ${error.status}. Please try again.`;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  private resetForm(): void {
    this.policyForm.reset({
      name: '',
      type: 'Domain',
      domain: '',
      ip: '',
      port: '',
      application: '',
      activatePolicy: false
    });
    this.filteredApplications = [];
    this.updateValidationForType('Domain');

    // Clear submission states
    this.isSubmitting = false;
    this.submitError = '';
    this.submitSuccess = '';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.policyForm.controls).forEach(key => {
      const control = this.policyForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancelUpload(): void {
    if (this.isUploading) {
      return; // Prevent closing modal during upload
    }
    this.showUploadModal = false;
    this.selectedFile = null;
    this.uploadError = '';
    this.uploadSuccess = '';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const validationResult = this.validateFile(file);
      if (validationResult.isValid) {
        this.selectedFile = file;
        this.uploadError = '';
      } else {
        this.selectedFile = null;
        this.uploadError = validationResult.error;
        // Clear the input
        event.target.value = '';
      }
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validationResult = this.validateFile(file);
      if (validationResult.isValid) {
        this.selectedFile = file;
        this.uploadError = '';
      } else {
        this.selectedFile = null;
        this.uploadError = validationResult.error;
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  onUploadFileSubmit(): void {
    if (!this.selectedFile) {
      this.uploadError = 'Please select a file to upload.';
      return;
    }

    const validationResult = this.validateFile(this.selectedFile);
    if (!validationResult.isValid) {
      this.uploadError = validationResult.error;
      return;
    }

    this.isUploading = true;
    this.uploadError = '';
    this.uploadSuccess = '';

    this.uploadFile(this.selectedFile).subscribe({
      next: (response) => {
        this.isUploading = false;
        this.uploadSuccess = 'File uploaded successfully!';

        // Close modal and reset
        setTimeout(() => {
          this.showUploadModal = false;
          this.selectedFile = null;
          this.uploadSuccess = '';
          this.showSuccessMessage = true;
          setTimeout(() => {
            this.showSuccessMessage = false;
          }, 3000);
        }, 1500);
      },
      error: (error) => {
        this.isUploading = false;
        console.error('File upload failed:', error);
        this.uploadError = this.getErrorMessage(error);
      }
    });
  }

  private validateFile(file: File): { isValid: boolean; error: string } {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.ACCEPTED_FILE_TYPES.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Invalid file type. Only CSV files are supported.`
      };
    }

    // Check file size
    if (file.size < this.MIN_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size is too small. Minimum size is 1 KB.`
      };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size is too large. Maximum size is 5 MB.`
      };
    }

    return { isValid: true, error: '' };
  }

  private uploadFile(file: File): Observable<any> {
    const token = this.authService.getAuthToken();

    const formData = new FormData();
    formData.append('file', file);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'accept': '*/*'
      // Note: Don't set Content-Type for FormData, let browser set it with boundary
    });

    console.log('Uploading file:', file.name);
    console.log('File size:', file.size, 'bytes');
    console.log('Upload endpoint:', this.uploadApiUrl);

    return this.http.post(this.uploadApiUrl, formData, { headers });
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
