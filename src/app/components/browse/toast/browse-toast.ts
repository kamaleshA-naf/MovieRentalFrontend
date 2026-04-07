import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseToastService } from '../../../services/browse-toast.service';

@Component({
  selector: 'app-browse-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './browse-toast.html',
  styleUrl: './browse-toast.css'
})
export class BrowseToastComponent {
  toast = inject(BrowseToastService);
}
