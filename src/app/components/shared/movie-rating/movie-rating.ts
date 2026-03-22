import {
  Component, Input, Output, EventEmitter,
  signal, inject, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService }  from '../../../services/auth.service';
import { RatingService } from '../../../services/rating.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-movie-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rating-wrap">
      <button class="rate-trigger"
        (click)="toggle()"
        [class.has-rating]="currentRating() > 0">
        @if (currentRating() === 1) {
          <span class="r-icon r-bad">👎</span>
          <span class="r-text">Not for me</span>
        } @else if (currentRating() === 2) {
          <span class="r-icon r-good">👍</span>
          <span class="r-text">I like this</span>
        } @else if (currentRating() === 3) {
          <span class="r-icon r-love">❤️</span>
          <span class="r-text">Love this!</span>
        } @else {
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill="currentColor" opacity="0.5">
            <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
          </svg>
          <span class="r-text">Rate</span>
        }
      </button>

      @if (open()) {
        <div class="rate-popup">
          <button class="r-opt r-opt-bad"
            [class.selected]="currentRating() === 1"
            (click)="rate(1)">
            <span class="r-emoji">👎</span>
            <span>Not for me</span>
          </button>
          <button class="r-opt r-opt-good"
            [class.selected]="currentRating() === 2"
            (click)="rate(2)">
            <span class="r-emoji">👍</span>
            <span>I like this</span>
          </button>
          <button class="r-opt r-opt-love"
            [class.selected]="currentRating() === 3"
            (click)="rate(3)">
            <span class="r-emoji">❤️</span>
            <span>Love this!</span>
          </button>
        </div>
        <div class="rate-back" (click)="open.set(false)"></div>
      }
    </div>
  `,
  styles: [`
    .rating-wrap { position: relative; display: inline-block; }

    .rate-trigger {
      display: flex; align-items: center; gap: 0.4rem;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(245,245,247,0.6);
      border-radius: 8px; padding: 0.5rem 0.85rem;
      font-size: 0.82rem; cursor: pointer;
      transition: all 0.2s;
    }
    .rate-trigger:hover { background: rgba(255,255,255,0.12); }
    .rate-trigger.has-rating {
      background: rgba(10,132,255,0.1);
      border-color: rgba(10,132,255,0.3);
      color: #0a84ff;
    }
    .r-text { font-size: 0.8rem; }

    .rate-popup {
      position: absolute; bottom: calc(100% + 10px);
      left: 50%; transform: translateX(-50%);
      display: flex; gap: 0.4rem;
      background: rgba(22,22,24,0.98);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px; padding: 0.5rem;
      box-shadow: 0 12px 40px rgba(0,0,0,0.7);
      z-index: 300; white-space: nowrap;
      animation: popUp 0.2s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes popUp {
      from { opacity: 0; transform: translateX(-50%) scale(0.85); }
      to   { opacity: 1; transform: translateX(-50%) scale(1); }
    }

    .r-opt {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.25rem; background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(255,255,255,0.08);
      border-radius: 10px; padding: 0.6rem 0.85rem;
      cursor: pointer; transition: all 0.18s; min-width: 75px;
      color: rgba(245,245,247,0.7); font-size: 0.72rem;
    }
    .r-opt:hover { transform: scale(1.06); }
    .r-emoji { font-size: 1.4rem; }

    .r-opt-bad.selected   { background: rgba(255,55,95,0.15);  border-color: #ff375f; color: #ff375f; }
    .r-opt-good.selected  { background: rgba(10,132,255,0.15); border-color: #0a84ff; color: #0a84ff; }
    .r-opt-love.selected  { background: rgba(255,45,120,0.15); border-color: #ff2d78; color: #ff2d78; }

    .rate-back {
      position: fixed; inset: 0; z-index: 299;
    }
  `]
})
export class MovieRatingComponent implements OnInit {
  @Input() movieId!: number;
  @Input() current = 0;   // optional pre-loaded rating
  @Output() rated  = new EventEmitter<number>();

  private auth        = inject(AuthService);
  private ratingSvc   = inject(RatingService);
  private toastr      = inject(ToastrService);

  open          = signal(false);
  currentRating = signal(0);
  isRating      = signal(false);

  ngOnInit(): void {
    this.currentRating.set(this.current ?? 0);
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (userId && this.movieId) {
      this.ratingSvc
        .getUserRatingForMovie(this.movieId, userId)
        .subscribe(res => {
          if (res && !res.isRemoved) {
            this.currentRating.set(res.ratingValue);
          }
        });
    }
  }

  toggle(): void {
    this.open.update(v => !v);
  }

  rate(value: number): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId || this.isRating()) return;

    this.isRating.set(true);
    this.open.set(false);

    this.ratingSvc.rateMovie(this.movieId, {
      userId, ratingValue: value
    }).subscribe({
      next: (res) => {
        this.isRating.set(false);
        const newVal = res.isRemoved ? 0 : res.ratingValue;
        this.currentRating.set(newVal);
        this.rated.emit(newVal);
        if (res.isRemoved) {
          this.toastr.info('Rating removed.', 'Rating');
        } else {
          const labels: Record<number, string> = {
            1: 'Not for me 👎',
            2: 'I like this 👍',
            3: 'Love this! ❤️'
          };
          this.toastr.success(labels[value], 'Rated');
        }
      },
      error: (err: any) => {
        this.isRating.set(false);
        this.toastr.error(
          err?.error?.message ?? 'Rating failed.', 'Error'
        );
      }
    });
  }
}