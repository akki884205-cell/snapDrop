import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
  selector: 'app-loading-bar',
  templateUrl: './loading-bar.component.html',
  styleUrls: ['./loading-bar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingBarComponent {
  @Input() ariaLabel: string = 'Loading';
}
