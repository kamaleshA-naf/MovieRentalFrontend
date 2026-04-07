import { Component, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseMovie } from '../../../models/browse.model';
import { BrowseStore } from '../../../services/browse.store';
import { BrowseToastService } from '../../../services/browse-toast.service';

@Component({
  selector: 'app-browse-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './movie-card.html',
  styleUrl: './movie-card.css'
})
export class BrowseCardComponent implements OnInit {
  movie     = input.required<BrowseMovie>();
  cardClick = output<BrowseMovie>();

  store = inject(BrowseStore);
  toast = inject(BrowseToastService);

  imgSrc = signal('');

  ngOnInit(): void {
    this.imgSrc.set(this.movie().thumbnail || this.store.placeholder);
  }

  onImgError(): void {
    this.imgSrc.set(this.store.placeholder);
  }

  toggleList(e: Event): void {
    e.stopPropagation();
    const m = this.movie();
    this.store.toggleMyList(m.id);
    this.toast.show(
      this.store.isInMyList(m.id)
        ? `"${m.title}" added to My List`
        : `"${m.title}" removed from My List`,
      'success'
    );
  }
}
