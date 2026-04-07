import { Component, inject, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseStore } from '../../../services/browse.store';

const FIXED_CATEGORIES = [
  { key: 'mylist',   label: '❤ My List'            },
  { key: 'trending', label: '🔥 Trending'           },
  { key: 'south',    label: '🎬 South Indian Cinema' },
  { key: 'az',       label: '🔤 A–Z Browse'         },
];

@Component({
  selector: 'app-category-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-panel.html',
  styleUrl: './category-panel.css'
})
export class CategoryPanelComponent {
  store  = inject(BrowseStore);
  active = input<string>('');
  close  = output<void>();
  select = output<string>();

  fixedCategories = FIXED_CATEGORIES;
}
