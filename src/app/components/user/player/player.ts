import {
  Component, inject, signal, OnInit, OnDestroy,
  ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService }  from '../../../services/movie.service';
import { RentalService } from '../../../services/rental.service';
import { AuthService }   from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse } from '../../../models/movie.model';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.html',
  styleUrl: './player.css'
})
export class PlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private http         = inject(HttpClient);
  movieService         = inject(MovieService);
  rentalService        = inject(RentalService);
  auth                 = inject(AuthService);
  private toastr       = inject(ToastrService);

  private readonly BASE_URL = 'https://localhost:7021';
  private readonly API      = 'https://localhost:7021/api';

  movie           = signal<MovieResponse | null>(null);
  isLoading       = signal(true);
  hasAccess       = signal(false);
  isRentalExpired = signal(false);
  videoSrc        = signal('');

  isPlaying    = signal(false);
  isMuted      = signal(false);
  isFullscreen = signal(false);
  currentTime  = signal(0);
  duration     = signal(0);
  volume       = signal(1);
  showControls = signal(true);
  videoError   = signal('');

  private hideTimer: any;

  ngOnInit(): void {
    const id     = Number(this.route.snapshot.paramMap.get('id'));
    const userId = this.auth.currentUser()?.userId ?? 0;

    if (userId > 0) {
      this.rentalService.loadMyRentals(userId);
    }

    this.movieService.getMovieById(id).subscribe({
      next: (m) => {
        this.movie.set(m);

        setTimeout(() => {
          const rental = this.rentalService.getRentalForMovie(m.id);

          if (rental &&
              rental.status === 'Active' &&
              new Date(rental.expiryDate) > new Date()) {

            this.hasAccess.set(true);

            if (m.videoUrl) {
              const src = m.videoUrl.startsWith('http')
                ? m.videoUrl
                : `${this.BASE_URL}${m.videoUrl}`;
              this.videoSrc.set(src);
            }

            // ✅ Increment view count — inline HTTP call, no service method needed
            this.http.put<any>(`${this.API}/Movie/${m.id}/view`, {}).subscribe({
              error: () => {} // silent fail — view count is non-critical
            });

          } else if (rental) {
            this.isRentalExpired.set(true);
            this.toastr.warning('Your rental has expired.', 'Expired');
            setTimeout(() => this.router.navigate(['/movie', id]), 2500);

          } else {
            this.toastr.error('Please rent this movie first.', 'Access Denied');
            setTimeout(() => this.router.navigate(['/movie', id]), 2500);
          }

          this.isLoading.set(false);
        }, 600);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error('Movie not found', 'Error');
        this.router.navigate(['/home']);
      }
    });
  }

  ngOnDestroy(): void { clearTimeout(this.hideTimer); }

  onMouseMove(): void {
    this.showControls.set(true);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.isPlaying()) this.showControls.set(false);
    }, 3000);
  }

  togglePlay(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => this.toastr.error('Could not play video', 'Error'));
      this.isPlaying.set(true);
    } else {
      v.pause();
      this.isPlaying.set(false);
    }
  }

  toggleMute(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.muted = !v.muted;
    this.isMuted.set(v.muted);
  }

  onTimeUpdate(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    this.currentTime.set(v.currentTime);
    this.duration.set(isNaN(v.duration) ? 0 : v.duration);
  }

  seek(e: Event): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.currentTime = Number((e.target as HTMLInputElement).value);
  }

  onVolumeChange(e: Event): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    const val = Number((e.target as HTMLInputElement).value);
    v.volume = val;
    this.volume.set(val);
    this.isMuted.set(val === 0);
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullscreen.set(true);
    } else {
      document.exitFullscreen();
      this.isFullscreen.set(false);
    }
  }

  onVideoError(): void {
    this.videoError.set(
      'Video failed to load. The file may be missing or in an unsupported format.'
    );
  }

  formatTime(sec: number): string {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  progressPercent(): number {
    if (!this.duration()) return 0;
    return (this.currentTime() / this.duration()) * 100;
  }

  goBack(): void {
    this.router.navigate(['/movie', this.movie()?.id ?? 0]);
  }
}