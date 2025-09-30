import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WhitelistService } from '../../services/whitelist.service';
import { WhitelistEntry } from '../../models/whitelist-entry.model';

@Component({
  selector: 'app-whitelist-panel',
  templateUrl: './whitelist-panel.component.html',
  styleUrls: ['./whitelist-panel.component.css']
})
export class WhitelistPanelComponent implements OnInit, OnDestroy {
  form: FormGroup;
  entries: WhitelistEntry[] = [];
  displayedEntries: WhitelistEntry[] = [];
  editingId: string | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  limitReached = false;
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 1;
  readonly pageSizeOptions: number[] = [5, 10, 25, 50];
  showPageSizeDropdown = false;
  private subscription?: Subscription;
  private messageTimer: any;

  constructor(private fb: FormBuilder, public whitelistService: WhitelistService) {
    this.form = this.fb.group({
      value: ['', [Validators.required, this.noWhitespaceValidator, this.ipFormatValidator, this.conflictValidator]],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.subscription = this.whitelistService.entries$.subscribe({
      next: entries => {
        this.entries = entries;
        this.limitReached = entries.length >= this.whitelistService.maxEntries;
        this.isLoading = false;
        if (this.limitReached && !this.editingId) {
          this.form.get('value')?.disable({ emitEvent: false });
        } else {
          this.form.get('value')?.enable({ emitEvent: false });
        }
        if (this.valueControl?.value) {
          this.valueControl.updateValueAndValidity({ emitEvent: false });
        }
        this.updatePagination();
      },
      error: () => {
        this.errorMessage = 'Unable to load whitelist entries. Please try again.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = undefined;
    }
  }

  get remainingSlots(): number {
    return Math.max(this.whitelistService.maxEntries - this.entries.length, 0);
  }

  get valueControl(): AbstractControl | null {
    return this.form.get('value');
  }

  get descriptionControl(): AbstractControl | null {
    return this.form.get('description');
  }

  get submitDisabled(): boolean {
    if (this.isSaving) {
      return true;
    }
    if (!this.editingId && this.limitReached) {
      return true;
    }
    return this.form.invalid;
  }

  trackById(_index: number, entry: WhitelistEntry): string {
    return entry.id;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.valueControl?.value as string;
    const trimmedValue = rawValue?.trim() || '';
    const description = (this.descriptionControl?.value as string)?.trim() || undefined;

    const validation = this.whitelistService.validateValue(trimmedValue);
    if (!validation.valid) {
      this.valueControl?.setErrors({ invalidIp: validation.message || 'Invalid entry.' });
      this.valueControl?.markAsTouched();
      this.valueControl?.markAsDirty();
      return;
    }

    const conflictMessage = this.whitelistService.assessConflicts(trimmedValue, this.editingId || undefined);
    if (conflictMessage) {
      this.valueControl?.setErrors({ conflict: conflictMessage });
      this.valueControl?.markAsTouched();
      this.valueControl?.markAsDirty();
      return;
    }

    if (validation.warning) {
      const confirmed = window.confirm(validation.warning);
      if (!confirmed) {
        return;
      }
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const save$ = this.editingId
      ? this.whitelistService.updateEntry(this.editingId, trimmedValue, description)
      : this.whitelistService.addEntry(trimmedValue, description);

    save$.subscribe({
      next: entry => {
        this.isSaving = false;
        this.successMessage = this.editingId ? 'Whitelist entry updated.' : 'Whitelist entry added.';
        this.editingId = null;
        this.currentPage = 1;
        this.resetForm();
        this.updatePagination();
        this.scheduleMessageClear();
      },
      error: err => {
        this.isSaving = false;
        const message = err?.message || 'Unable to save whitelist entry.';
        this.errorMessage = message;
        if (!this.valueControl?.errors && /entry/i.test(message)) {
          this.valueControl?.setErrors({ conflict: message });
        }
        this.scheduleMessageClear();
      }
    });
  }

  onEdit(entry: WhitelistEntry): void {
    this.editingId = entry.id;
    this.form.reset({
      value: entry.value,
      description: entry.description || ''
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.valueControl?.enable({ emitEvent: false });
    this.valueControl?.updateValueAndValidity({ emitEvent: false });
  }

  onCancelEdit(): void {
    this.editingId = null;
    this.resetForm();
    if (this.limitReached) {
      this.valueControl?.disable({ emitEvent: false });
    }
    this.valueControl?.updateValueAndValidity({ emitEvent: false });
  }

  onRemove(entry: WhitelistEntry): void {
    if (!window.confirm(`Remove ${entry.value} from the whitelist?`)) {
      return;
    }

    this.whitelistService.removeEntry(entry.id).subscribe({
      next: () => {
        this.successMessage = 'Whitelist entry removed.';
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
        this.updatePagination();
        this.scheduleMessageClear();
      },
      error: err => {
        this.errorMessage = err?.message || 'Unable to remove whitelist entry.';
        this.scheduleMessageClear();
      }
    });
  }

  getStatus(entry: WhitelistEntry): string {
    return entry.active === false ? 'Not Enforced' : 'Enforced';
  }

  togglePageSizeDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showPageSizeDropdown = !this.showPageSizeDropdown;
  }

  onPageSizeChange(size: number): void {
    if (this.pageSize === size) {
      this.showPageSizeDropdown = false;
      return;
    }
    this.pageSize = size;
    this.currentPage = 1;
    this.showPageSizeDropdown = false;
    this.updatePagination();
  }

  onPageChange(page: number): void {
    if (page === this.currentPage) {
      return;
    }
    this.currentPage = page;
    this.updatePagination();
  }

  onPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  onNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  onFirstPage(): void {
    if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.updatePagination();
    }
  }

  onLastPage(): void {
    if (this.currentPage !== this.totalPages) {
      this.currentPage = this.totalPages;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 6;

    if (this.totalPages <= maxPages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, this.currentPage - 2);
      let end = Math.min(this.totalPages, start + maxPages - 1);

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

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showPageSizeDropdown) {
      this.showPageSizeDropdown = false;
    }
  }

  private resetForm(): void {
    this.form.reset({ value: '', description: '' });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.valueControl?.updateValueAndValidity({ emitEvent: false });
  }

  private scheduleMessageClear(): void {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
    }
    this.messageTimer = setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
      this.messageTimer = undefined;
    }, 3000);
  }

  private noWhitespaceValidator = (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === undefined) {
      return null;
    }
    const trimmed = control.value.toString().trim();
    return trimmed.length ? null : { whitespace: true };
  };

  private ipFormatValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || typeof control.value !== 'string') {
      return null;
    }
    const result = this.whitelistService.validateValue(control.value);
    return result.valid ? null : { invalidIp: result.message || 'Invalid entry.' };
  };

  private conflictValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || typeof control.value !== 'string') {
      return null;
    }
    const trimmed = control.value.trim();
    if (!trimmed) {
      return null;
    }
    const validation = this.whitelistService.validateValue(trimmed);
    if (!validation.valid) {
      return null;
    }
    const conflictMessage = this.whitelistService.assessConflicts(trimmed, this.editingId || undefined);
    return conflictMessage ? { conflict: conflictMessage } : null;
  };

  private updatePagination(): void {
    this.totalItems = this.entries.length;
    this.totalPages = this.totalItems === 0 ? 1 : Math.ceil(this.totalItems / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.displayedEntries = this.totalItems === 0 ? [] : this.entries.slice(start, end);
  }
}
