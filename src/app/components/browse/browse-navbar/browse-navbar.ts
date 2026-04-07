import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-browse-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './browse-navbar.html',
  styleUrl: './browse-navbar.css'
})
export class BrowseNavbarComponent {
  openCategories = output<void>();
  search         = output<string>();
  showSearch     = signal(false);
  searchQuery    = '';
}
