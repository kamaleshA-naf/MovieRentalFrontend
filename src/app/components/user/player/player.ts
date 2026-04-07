import {
  Component, inject, signal, OnInit, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MovieService }  from '../../../services/movie.service';
import { RentalService } from '../../../services/rental.service';
import { AuthService }   from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse } from '../../../models/movie.model';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '@env/environment';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.html',
  styleUrl: './player.css'
})
export class PlayerComponent implements OnInit, OnDestroy, AfterViewInit {

  // ── ViewChild: NO static flag — resolves after @if renders the element
  @ViewChild('videoRef') videoRef?: ElementRef<HTMLVideoElement>;

  private route     = inject(ActivatedRoute);
  readonly router   = inject(Router);          // readonly = accessible in template
  private http      = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  movieService         = inject(MovieService);
  rentalService        = inject(RentalService);
  auth                 = inject(AuthService);
  private toastr       = inject(ToastrService);

  private readonly BASE_URL = environment.mediaBase;
  private readonly API      = environment.apiBase;

  // ── State signals ──────────────────────────────────────────────
  movie           = signal<MovieResponse | null>(null);
  isLoading       = signal(true);
  hasAccess       = signal(false);
  isRentalExpired = signal(false);
  movieDeleted    = signal(false);   // 404 from API — movie permanently removed
  videoSrc        = signal('');                    // for <video>
  youtubeSrc      = signal<SafeResourceUrl | null>(null);  // for <iframe>
  isYoutube       = signal(false);

  isPlaying    = signal(false);
  isMuted      = signal(false);
  isFullscreen = signal(false);
  currentTime  = signal(0);
  duration     = signal(0);
  volume       = signal(1);
  showControls = signal(true);
  videoError   = signal('');
  isBuffering  = signal(false);
  bufferedEnd  = signal(0);

  // ── Internal flags ─────────────────────────────────────────────
  private hideTimer:  any;
  private playTimer:  any;
  private lastSrc   = '';   // track previous src to avoid redundant load()

  constructor() {
    // Only fires when videoSrc signal value changes.
    // Guards against re-loading a video that is already playing.
    effect(() => {
      const src = this.videoSrc();
      clearTimeout(this.playTimer);

      // Skip if no src, YouTube, or same URL already loaded
      if (!src || this.isYoutube() || src === this.lastSrc) return;
      this.lastSrc = src;

      this.playTimer = setTimeout(() => {
        const v = this.videoRef?.nativeElement;
        if (!v) return;
        // Only call load() if the element src actually differs
        if (v.currentSrc !== src) {
          v.load();
        }
        v.play()
          .then(() => this.isPlaying.set(true))
          .catch(() => this.isPlaying.set(false));
      }, 80);
    });
  }

  ngAfterViewInit(): void { /* play handled by effect() */ }

  ngOnInit(): void {
    const id     = Number(this.route.snapshot.paramMap.get('id'));
    const userId = this.auth.currentUser()?.userId ?? 0;

    if (!id) {
      this.router.navigate(['/home']);
      return;
    }

    // ── 1. Load movie details ──────────────────────────────────
    this.movieService.getMovieById(id).subscribe({
      next: (m) => {
        this.movie.set(m);

        if (userId <= 0) {
          this.toastr.error('Please log in to watch movies.', 'Login Required');
          this.router.navigate(['/login']);
          return;
        }

        // ── 2. Verify rental via direct HTTP (no signal race) ──
        this.http
          .get<any[]>(`${this.API}/Rental/user/${userId}`)
          .pipe(catchError(() => of([])))
          .subscribe(rentals => {
            const now = new Date();

            const activeRental = rentals.find((r: any) =>
              r.movieId === m.id &&
              new Date(r.expiryDate ?? r.endDate ?? r.ExpiryDate ?? 0) > now
            );

            const expiredRental = !activeRental &&
              rentals.some((r: any) => r.movieId === m.id);

            if (activeRental) {
              this.hasAccess.set(true);
              // Only resolve video if movie actually exists (not deleted)
              if (!this.movieDeleted()) {
                this.resolveVideoSrc(m.videoUrl);
              }

              // Increment view count — fires immediately, updates DB + local signal
              this.movieService.incrementView(m.id);
              // trending signal auto-refreshes inside incrementView

            } else if (expiredRental) {
              this.isRentalExpired.set(true);
              this.toastr.warning('Your rental has expired.', 'Expired');
              setTimeout(() => this.router.navigate(['/movie', id]), 2500);

            } else {
              this.toastr.error('Please rent this movie first.', 'Access Denied');
              setTimeout(() => this.router.navigate(['/movie', id]), 2500);
            }

            this.isLoading.set(false);
          });
      },
      error: (err) => {
        this.isLoading.set(false);
        // 404 = deleted, any other error = treat as unavailable too
        this.movieDeleted.set(true);
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.hideTimer);
    clearTimeout(this.playTimer);
    this.lastSrc = '';
    const v = this.videoRef?.nativeElement;
    if (v) { v.pause(); v.src = ''; v.load(); }
  }

  // ─────────────────────────────────────────────────────────────
  // Resolve video source — detect YouTube vs local/remote file
  // ─────────────────────────────────────────────────────────────
  private resolveVideoSrc(rawUrl: string | null | undefined): void {
    if (!rawUrl) {
      // No video attached to this movie
      this.videoSrc.set('');
      return;
    }

    if (this.isYoutubeUrl(rawUrl)) {
      // ── YouTube: convert to embed URL and sanitize ──────────
      this.isYoutube.set(true);
      const embedUrl = this.toYoutubeEmbed(rawUrl);
      this.youtubeSrc.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      );

    } else {
      // ── Local file or external direct video URL ─────────────
      this.isYoutube.set(false);
      const src = rawUrl.startsWith('http')
        ? rawUrl
        : `${this.BASE_URL}${rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl}`;
      // Do NOT append cache-buster — it breaks HTTP range requests
      // which causes the browser to buffer the entire file before playing
      this.videoSrc.set(src);
    }
  }

  private isYoutubeUrl(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  private toYoutubeEmbed(url: string): string {
    const params = 'autoplay=1&rel=0&modestbranding=1&enablejsapi=1';
    // Handle youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) {
      return `https://www.youtube.com/embed/${shortMatch[1]}?${params}`;
    }
    // Handle youtube.com/watch?v=VIDEO_ID
    const longMatch = url.match(/[?&]v=([^&]+)/);
    if (longMatch) {
      return `https://www.youtube.com/embed/${longMatch[1]}?${params}`;
    }
    // Already an embed URL — just ensure params
    if (url.includes('/embed/')) {
      return url.includes('?') ? `${url}&${params}` : `${url}?${params}`;
    }
    return url;
  }

  // ─────────────────────────────────────────────────────────────
  // Video element event handlers
  // ─────────────────────────────────────────────────────────────
  onMetadataLoaded(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    this.duration.set(isNaN(v.duration) ? 0 : v.duration);
  }

  onTimeUpdate(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    this.currentTime.set(v.currentTime);
    if (!this.duration() && !isNaN(v.duration)) {
      this.duration.set(v.duration);
    }
  }

  onVideoError(event: Event): void {
    const v = event.target as HTMLVideoElement;
    const code = v?.error?.code ?? 0;
    const messages: Record<number, string> = {
      1: 'Video loading was aborted.',
      2: 'Network error while loading video.',
      3: 'Video decoding failed — file may be corrupted.',
      4: 'Video format not supported by this browser.'
    };
    this.videoError.set(
      messages[code] ?? 'Video failed to load. Please check the uploaded file.'
    );
    console.error('[Player] Video error code:', code, v?.error?.message);
  }

  onVideoCanPlay(): void {
    this.isBuffering.set(false);
    // Don't call play() here — effect() already handles it.
    // Calling play() twice causes AbortError in some browsers.
  }

  onProgress(): void {
    const v = this.videoRef?.nativeElement;
    if (!v || !v.buffered.length) return;
    // Track the furthest buffered end point
    this.bufferedEnd.set(v.buffered.end(v.buffered.length - 1));
  }

  onBuffering(state: boolean): void {
    this.isBuffering.set(state);
  }

  bufferedPercent(): number {
    const d = this.duration();
    if (!d || d <= 0) return 0;
    return Math.min(100, (this.bufferedEnd() / d) * 100);
  }

  // ─────────────────────────────────────────────────────────────
  // Player controls
  // ─────────────────────────────────────────────────────────────
  togglePlay(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => this.isPlaying.set(true))
        .catch(() => this.toastr.error('Could not play video.', 'Error'));
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

  seek(e: Event): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.currentTime = Number((e.target as HTMLInputElement).value);
    this.currentTime.set(v.currentTime);
  }

  onVolumeChange(e: Event): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    const val = Number((e.target as HTMLInputElement).value);
    v.volume = val;
    this.volume.set(val);
    this.isMuted.set(val === 0);
    if (v.muted && val > 0) v.muted = false;
  }

  toggleFullscreen(): void {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => this.isFullscreen.set(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => this.isFullscreen.set(false)).catch(() => {});
    }
  }

  onMouseMove(): void {
    this.showControls.set(true);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.isPlaying()) this.showControls.set(false);
    }, 3000);
  }

  progressPercent(): number {
    const d = this.duration();
    if (!d || d <= 0) return 0;
    return Math.min(100, (this.currentTime() / d) * 100);
  }

  formatTime(sec: number): string {
    if (!sec || isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  goBack(): void {
    this.router.navigate(['/movie', this.movie()?.id ?? 0]);
  }
}