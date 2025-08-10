import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, of, Observable, throwError, interval, takeWhile, finalize, Subscription } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService, User, PolicyToggleRequest } from '../services/auth.service';

export interface Policy {
  id: string;
  name: string;
  type: string;
  filters: string;
  target: string;
  provisionTime: string;
  lastUpdated: string;
  creationTime: string;
  actions: string;
  filterPid:string;
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
export class PoliciesComponent implements OnInit, OnDestroy {
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
    { key: 'provisionTime', label: 'Provision Time' },
    { key: 'lastUpdated', label: 'Last Updated' },
    { key: 'creationTime', label: 'Creation Time' },
    { key: 'status', label: 'Status' }
  ];

  // Reactive Form
  policyForm!: FormGroup;

  // Application autocomplete
  applicationOptions: string[] = [];
  filteredApplications: string[] = [];

  // API configuration - now using AuthService base URL and token

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

  // Toggle operation states
  toggleLoadingStates: Map<string, boolean> = new Map();
  pollingSubscriptions: Map<string, Subscription> = new Map();
  toggleErrors: Map<string, string> = new Map();
  toggleSuccess: Map<string, string> = new Map();

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

  loadPolicies(): void {
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

        // If it's an authentication error, redirect to login
        if (error.status === 401) {
          console.warn('Authentication failed, redirecting to login');
          this.authService.logout().subscribe(() => {
            this.router.navigate(['/']);
          });
        }
      }
    });
  }

  private fetchPolicies(page: number, size: number): Observable<PolicyListResponse> {
    const token = this.authService.getAuthToken();
    
    if (!token) {
      return throwError(() => new Error('No authentication token available'));
    }

    const headers = new HttpHeaders({
      'accept': '*/*',
      'Authorization': `Bearer ${token}`
    });

    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    const apiUrl = `${this.authService.getBaseUrl()}/api/filter-management`;
    console.log('Fetching policies from:', apiUrl, 'with params:', { page, size });
    console.log('Using token:', token ? 'Token available' : 'No token');

    return this.http.get<PolicyListResponse>(apiUrl, { headers, params });
  }

  private mapApiPoliciesToLocalPolicies(apiPolicies: PolicyApiItem[]): Policy[] {
    return apiPolicies.map(apiPolicy => ({
      id: apiPolicy.id.toString(),
      name: apiPolicy.filterName,
      type: apiPolicy.filterType,
      filters: apiPolicy.filterValue+' '+apiPolicy.updationTime, // Not provided in API response
      target: apiPolicy.domainIpValue ,
      provisionTime: apiPolicy.probeProvisionedTime ? 
        new Date(apiPolicy.probeProvisionedTime).toLocaleDateString() : 
        'Not Provisioned',
      lastUpdated: new Date(apiPolicy.updationTime).toLocaleDateString(),
      creationTime: new Date(apiPolicy.creationTime).toLocaleDateString(),
      filterPid: apiPolicy.filterPid,
      actions: 'Label',
      toggleActive: this.getToggleActiveStatus(apiPolicy.filterStatus),
      status: apiPolicy.filterStatus
    }));
  }

  private getToggleActiveStatus(filterStatus: string): boolean {
    // Return true if active, false for others (rejected will be handled with special red styling)
    switch (filterStatus.toLowerCase()) {
      case 'active':
      case 'activated':
        return true;
      case 'rejected':
      case 'failed':
      case 'inactive':
      case 'in progress':
      case 'pending':
      default:
        return false; // Rejected will show red toggle, others will be greyed out
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
    // Since we're using API-based pagination, the filteredPolicies already contains
    // only the current page's data, so we don't need to slice it again
    this.displayedPolicies = [...this.filteredPolicies];
    console.log(`Displaying ${this.displayedPolicies.length} policies for page ${this.currentPage}`);
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
      filterName: ['', [Validators.required, this.noWhitespaceValidator]],
      filterType: ['Domain', [Validators.required]],
      domain: [''],
      ip: [''],
      port: [''],
      application: [''],
      activatePolicy: [false]
    });

    // Subscribe to type changes to update validation dynamically
    this.policyForm.get('filterType')?.valueChanges.subscribe(type => {
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
    return this.policyForm.get('filterType')?.value || 'Domain';
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
      filterName: 'Name',
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

    const policyData = {
      filterName: this.policyForm.get('filterName')?.value,
      filterType: this.policyForm.get('filterType')?.value,
      filterValue: this.policyForm.get('domain')?.value,
      filterPid: this.policyForm.get('filterPid')?.value,
      domainIpValue: this.policyForm.get('domainIpValue')?.value,
      filterStatus: this.policyForm.get('activatePolicy')?.value ? 'ACTIVE' : 'INACTIVE',
      netifyFilter: true
    };

    console.log('Creating policy with data:', policyData);

    this.createPolicy(policyData).subscribe({
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

  private createPolicy(policyData: any): Observable<PolicyCreateResponse> {
    const token = this.authService.getAuthToken();

    const formData = new FormData();
    formData.append('policy', JSON.stringify(policyData));

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'accept': '*/*'
      // Note: Don't set Content-Type for FormData, let browser set it with boundary
    });

    const apiUrl = `${this.authService.getBaseUrl()}/api/filter-management`;
    console.log('Submitting policy:', policyData);
    console.log('API endpoint:', apiUrl);

    return this.http.post<PolicyCreateResponse>(apiUrl, formData, { headers });
  }


  private getErrorMessage(error: any): string {
    console.error('Full error object:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);

    // Handle Event objects (like network errors)
    if (error instanceof Event || (error && error.isTrusted !== undefined)) {
      return 'Network connection error. Please check your internet connection and try again.';
    }

    // Handle HttpErrorResponse
    if (error && error.status !== undefined) {
      // Check for HTTP error response body
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
      }

      // Check for specific HTTP status codes
      if (error.status === 0) {
        return 'Network error. Please check your connection and try again.';
      }
      if (error.status === 401) {
        return 'Authentication failed. Please login again.';
      }
      if (error.status === 403) {
        return 'Access denied. You do not have permission to access this resource.';
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

      // Generic HTTP error with status
      if (error.statusText && error.statusText !== 'Unknown Error') {
        return `Error ${error.status}: ${error.statusText}`;
      }

      return `Request failed with status ${error.status}. Please try again.`;
    }

    // Handle Error objects with message
    if (error instanceof Error && error.message) {
      return error.message;
    }

    // Check for direct message property
    if (error && typeof error.message === 'string') {
      return error.message;
    }

    // Handle string errors
    if (typeof error === 'string') {
      return error;
    }

    // Last resort
    return 'An unexpected error occurred. Please try again.';
  }

  private resetForm(): void {
    this.policyForm.reset({
      filterName: '',
      filterType: 'Domain',
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

    const uploadApiUrl = `${this.authService.getBaseUrl()}/api/filter-management/upload`;
    console.log('Uploading file:', file.name);
    console.log('File size:', file.size, 'bytes');
    console.log('Upload endpoint:', uploadApiUrl);

    return this.http.post(uploadApiUrl, formData, { headers });
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

  ngOnDestroy(): void {
    // Clean up all polling subscriptions
    this.pollingSubscriptions.forEach(subscription => {
      if (subscription && !subscription.closed) {
        subscription.unsubscribe();
      }
    });
    this.pollingSubscriptions.clear();
  }

  /**
   * Toggle policy status handler
   */
  onTogglePolicy(policy: Policy, index: number): void {
    const policyId = policy.id;
    
    // Prevent concurrent toggles for the same policy
    if (this.toggleLoadingStates.get(policyId)) {
      console.log('Toggle already in progress for policy:', policyId);
      return;
    }

    console.log('Toggling policy:', policy);
    
    // Clear previous messages
    this.toggleErrors.delete(policyId);
    this.toggleSuccess.delete(policyId);
    
    // Set loading state
    this.toggleLoadingStates.set(policyId, true);
    
    // Determine new status based on current toggle state
    const newStatus = policy.toggleActive ? 'INACTIVE' : 'ACTIVE';
    
    // Create toggle request from policy data
    const toggleRequest: PolicyToggleRequest = {
      filterName: policy.name,
      filterType: policy.type,
      filterValue: policy.filters,
      filterPid: policy.filterPid,
      domainIpValue: policy.target,
      filterStatus: newStatus,
      netifyFilter: true
    };
    
    // Call toggle API
    this.authService.togglePolicyStatus(parseInt(policyId), toggleRequest).subscribe({
      next: (response) => {
        console.log('Toggle API response:', response);
        
        // Get the new policy ID from the response
        const newPolicyId = response.id.toString();
        console.log(`Policy ID changed from ${policyId} to ${newPolicyId}`);
        
        // Replace the old policy with the new one at the same position
        this.replacePolicyWithNewId(policyId, response, index);
        
        // Transfer state management from old ID to new ID
        this.transferToggleState(policyId, newPolicyId);
        
        // Start status polling if status is "In Progress"
        if (response.filterStatus && response.filterStatus.toLowerCase().includes('progress')) {
          this.startStatusPolling(newPolicyId, index);
        } else {
          // If not in progress, just clear loading state and show success
          this.toggleLoadingStates.set(newPolicyId, false);
          this.toggleSuccess.set(newPolicyId, 'Policy status updated successfully');
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.toggleSuccess.delete(newPolicyId);
          }, 3000);
        }
      },
      error: (error) => {
        console.error('Toggle failed:', error);
        this.toggleLoadingStates.set(policyId, false);
        this.toggleErrors.set(policyId, error.message || 'Failed to toggle policy status');
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          this.toggleErrors.delete(policyId);
        }, 5000);
      }
    });
  }

  /**
   * Start status polling for a policy
   */
  private startStatusPolling(policyId: string, policyIndex: number): void {
    console.log(`Starting status polling for policy: ${policyId}`);
    
    // Cancel any existing polling for this policy
    const existingSubscription = this.pollingSubscriptions.get(policyId);
    if (existingSubscription && !existingSubscription.closed) {
      existingSubscription.unsubscribe();
    }
    
    // Start polling every 5 seconds
    const pollingSubscription = interval(5000).pipe(
      switchMap(() => this.authService.getPolicyStatus(parseInt(policyId))),
      takeWhile((policyStatus) => {
        console.log(`Policy ${policyId} status:`, policyStatus.filterStatus);
        return policyStatus.filterStatus === 'In Progress';
      }, true), // Include the final emission
      finalize(() => {
        console.log(`Polling completed for policy: ${policyId}`);
        this.toggleLoadingStates.set(policyId, false);
        this.pollingSubscriptions.delete(policyId);
      })
    ).subscribe({
      next: (policyStatus) => {
        console.log(`Polling update for policy ${policyId}:`, policyStatus);
        
        // Update the policy in the local array
        this.updatePolicyFromApiResponse(policyId, policyStatus);
        
        // If status is not INPROGRESS, polling will stop automatically
        if (policyStatus.filterStatus !== 'In Progress') {
          this.toggleSuccess.set(policyId, 'Policy status updated successfully');
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.toggleSuccess.delete(policyId);
          }, 3000);
        }
      },
      error: (error) => {
        console.error(`Polling error for policy ${policyId}:`, error);
        this.toggleLoadingStates.set(policyId, false);
        this.toggleErrors.set(policyId, error.message || 'Failed to check policy status');
        this.pollingSubscriptions.delete(policyId);
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          this.toggleErrors.delete(policyId);
        }, 5000);
      }
    });
    
    // Store the subscription for cleanup
    this.pollingSubscriptions.set(policyId, pollingSubscription);
  }

  /**
   * Replace policy with new ID from toggle response
   */
  private replacePolicyWithNewId(oldPolicyId: string, apiResponse: any, originalIndex: number): void {
    console.log(`Replacing policy ${oldPolicyId} with new policy from API response`);
    
    // Create the new policy from API response
    const newPolicy = this.mapApiPolicyToLocalPolicy(apiResponse);
    
    // Find and replace in main policies array
    const policyIndex = this.policies.findIndex(p => p.id === oldPolicyId);
    if (policyIndex !== -1) {
      this.policies[policyIndex] = newPolicy;
      console.log(`Updated policy at index ${policyIndex} in main policies array`);
    }
    
    // Find and replace in filtered policies array
    const filteredIndex = this.filteredPolicies.findIndex(p => p.id === oldPolicyId);
    if (filteredIndex !== -1) {
      this.filteredPolicies[filteredIndex] = newPolicy;
      console.log(`Updated policy at index ${filteredIndex} in filtered policies array`);
    }
    
    // Update displayed policies
    this.updateDisplayedPolicies();
  }

  /**
   * Transfer toggle state from old policy ID to new policy ID
   */
  private transferToggleState(oldPolicyId: string, newPolicyId: string): void {
    console.log(`Transferring toggle state from ${oldPolicyId} to ${newPolicyId}`);
    
    // Transfer loading state
    const loadingState = this.toggleLoadingStates.get(oldPolicyId);
    if (loadingState !== undefined) {
      this.toggleLoadingStates.set(newPolicyId, loadingState);
      this.toggleLoadingStates.delete(oldPolicyId);
    }
    
    // Transfer polling subscription
    const pollingSubscription = this.pollingSubscriptions.get(oldPolicyId);
    if (pollingSubscription) {
      this.pollingSubscriptions.set(newPolicyId, pollingSubscription);
      this.pollingSubscriptions.delete(oldPolicyId);
    }
    
    // Transfer error state (if any)
    const errorState = this.toggleErrors.get(oldPolicyId);
    if (errorState) {
      this.toggleErrors.set(newPolicyId, errorState);
      this.toggleErrors.delete(oldPolicyId);
    }
    
    // Transfer success state (if any)
    const successState = this.toggleSuccess.get(oldPolicyId);
    if (successState) {
      this.toggleSuccess.set(newPolicyId, successState);
      this.toggleSuccess.delete(oldPolicyId);
    }
  }

  /**
   * Update policy from API response (legacy method for polling)
   */
  private updatePolicyFromApiResponse(policyId: string, apiPolicy: any): void {
    // Find and update the policy in the main policies array
    const policyIndex = this.policies.findIndex(p => p.id === policyId);
    if (policyIndex !== -1) {
      const updatedPolicy = this.mapApiPolicyToLocalPolicy(apiPolicy);
      this.policies[policyIndex] = updatedPolicy;
      
      // Update filtered policies if needed
      const filteredIndex = this.filteredPolicies.findIndex(p => p.id === policyId);
      if (filteredIndex !== -1) {
        this.filteredPolicies[filteredIndex] = updatedPolicy;
      }
      
      // Update displayed policies
      this.updateDisplayedPolicies();
    }
  }

  /**
   * Map single API policy to local policy format
   */
  private mapApiPolicyToLocalPolicy(apiPolicy: any): Policy {
    return {
      id: apiPolicy.id.toString(),
      name: apiPolicy.filterName,
      type: apiPolicy.filterType,
      filters: apiPolicy.filterValue || '',
      target: apiPolicy.domainIpValue,
      provisionTime: apiPolicy.probeProvisionedTime ? new Date(apiPolicy.probeProvisionedTime).toLocaleDateString() : 'N/A',
      lastUpdated: apiPolicy.updationTime ? new Date(apiPolicy.updationTime).toLocaleDateString() : 
                   (apiPolicy.probeProvisionedTime ? new Date(apiPolicy.probeProvisionedTime).toLocaleDateString() : 'N/A'),
      creationTime: new Date(apiPolicy.creationTime).toLocaleDateString(),
      filterPid: apiPolicy.filterPid || '',
      actions: 'Edit, Delete',
      toggleActive: this.getToggleActiveStatus(apiPolicy.filterStatus),
      status: apiPolicy.filterStatus
    };
  }

  /**
   * Check if policy toggle is loading
   */
  isPolicyToggleLoading(policyId: string): boolean {
    return this.toggleLoadingStates.get(policyId) || false;
  }

  /**
   * Get toggle error message for policy
   */
  getPolicyToggleError(policyId: string): string | undefined {
    return this.toggleErrors.get(policyId);
  }

  /**
   * Get toggle success message for policy
   */
  getPolicyToggleSuccess(policyId: string): string | undefined {
    return this.toggleSuccess.get(policyId);
  }

  /**
   * Check if policy toggle is disabled (during loading or concurrent operations)
   */
  isPolicyToggleDisabled(policyId: string): boolean {
    return this.isPolicyToggleLoading(policyId) || this.pollingSubscriptions.has(policyId);
  }
}
