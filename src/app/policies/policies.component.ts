import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';

export interface ChecklistItem {
  id: number;
  label: string;
  completed: boolean;
  active: boolean;
}

@Component({
  selector: 'app-policies',
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.css']
})
export class PoliciesComponent implements OnInit {
  currentUser: User | null = null;
  
  checklistItems: ChecklistItem[] = [
    {
      id: 1,
      label: 'Step 1',
      completed: true,
      active: true
    },
    {
      id: 2,
      label: 'Step 2',
      completed: false,
      active: false
    },
    {
      id: 3,
      label: 'Step 3',
      completed: false,
      active: false
    }
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
  }

  onToggleItem(itemId: number): void {
    const item = this.checklistItems.find(i => i.id === itemId);
    if (item) {
      item.active = !item.active;
      item.completed = item.active;
    }
  }

  onDropdownClick(): void {
    console.log('Dropdown clicked');
  }
}
