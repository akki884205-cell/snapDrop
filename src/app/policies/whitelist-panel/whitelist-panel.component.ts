import { Component, OnDestroy, OnInit } from '@angular/core';
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
  editingId: string | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  limitReached = false;
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
        this.resetForm();
        this.editingId = null;
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
}
