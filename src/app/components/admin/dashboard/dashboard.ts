import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MovieService } from '../../../services/movie.service';
import { AuthService }  from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { MovieResponse } from '../../../models/movie.model';
import { AdminUploadMovieComponent } from '../upload-movie/upload-movie';
import {
  AdminService,
  AdminDashboardStats,
  AdminPaymentItem
} from '../../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminUploadMovieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  adminService = inject(AdminService);
  auth         = inject(AuthService);
  movieService = inject(MovieService);
  toastr       = inject(ToastrService);

  activeTab    = signal<string>('overview');
  isLoading    = signal(true);
  stats        = signal<AdminDashboardStats | null>(null);
  recentUsers  = signal<any[]>([]);
  recentPays   = signal<AdminPaymentItem[]>([]);
  editingMovie = signal<MovieResponse | null>(null);
  deletingId   = signal<number | null>(null);

  ngOnInit(): void {
    this.loadDashboard();
    this.movieService.getAllMovies(1, 100);
    this.movieService.loadGenres();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.adminService.getDashboardStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null)
    });
    this.adminService.getAllUsersWithRentals().subscribe({
      next: (u: any[]) => this.recentUsers.set(u),
      error: () => this.recentUsers.set([])
    });
    this.adminService.getAllPaymentsSummary().subscribe({
      next: (p) => {
        this.recentPays.set(p.payments ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.recentPays.set([]);
        this.isLoading.set(false);
      }
    });
  }

  openAdd(): void {
    this.editingMovie.set(null);
    this.activeTab.set('upload');
  }

  openEdit(movie: MovieResponse): void {
    this.editingMovie.set(movie);
    this.activeTab.set('edit');
  }

  onUploaded(): void {
    this.activeTab.set('movies');
    this.editingMovie.set(null);
    this.movieService.getAllMovies(1, 100);
    this.loadDashboard();
  }

  onCancelled(): void {
    this.activeTab.set('movies');
    this.editingMovie.set(null);
  }

  deleteMovie(movie: MovieResponse): void {
    if (!confirm(`Delete "${movie.title}"?`)) return;
    this.deletingId.set(movie.id);
    this.movieService.deleteMovie(movie.id).subscribe({
      next: () => {
        this.toastr.success(`"${movie.title}" deleted`, 'Deleted');
        this.deletingId.set(null);
        this.movieService.getAllMovies(1, 100);
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message ?? 'Delete failed', 'Error');
        this.deletingId.set(null);
      }
    });
  }

  toggleActive(movie: MovieResponse): void {
    const msg = movie.isActive
      ? `Pause "${movie.title}"? It will become unavailable.`
      : `Activate "${movie.title}"?`;
    if (!confirm(msg)) return;
    this.movieService.updateMovie(movie.id, { isActive: !movie.isActive }).subscribe({
      next: () => {
        this.toastr.success(
          `Movie ${movie.isActive ? 'paused' : 'activated'}.`,
          movie.isActive ? 'Paused' : 'Activated'
        );
        this.movieService.getAllMovies(1, 100);
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message ?? 'Update failed.', 'Error');
      }
    });
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return '₹' + (amount ?? 0).toLocaleString('en-IN');
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'status-completed';
      case 'Pending':   return 'status-pending';
      case 'Failed':    return 'status-failed';
      case 'Active':    return 'status-active';
      case 'Expired':   return 'status-expired';
      case 'Returned':  return 'status-returned';
      default:          return '';
    }
  }
}