import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PaymentService, PaymentSummary }
  from '../../../services/payment.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payments.html',
  styleUrl: './payments.css'
})
export class AdminPaymentsComponent implements OnInit {
  auth           = inject(AuthService);
  paymentService = inject(PaymentService);
  private toastr = inject(ToastrService);

  searchQuery   = signal('');
  statusFilter  = signal('all');
  sortBy        = signal('latest');
  currentPage   = signal(1);
  pageSize      = 10;
  activeTab     = signal<'table' | 'charts'>('table');

  ngOnInit(): void {
    this.paymentService.loadAllPayments();
    this.paymentService.loadStats();
  }

  filtered = computed(() => {
    let list = [...this.paymentService.payments()];
    const q  = this.searchQuery().toLowerCase().trim();

    if (q) {
      list = list.filter(p =>
        p.userName?.toLowerCase().includes(q) ||
        p.movieTitle?.toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    }

    if (this.statusFilter() !== 'all') {
      list = list.filter(
        p => p.status?.toLowerCase() ===
             this.statusFilter().toLowerCase()
      );
    }

    if (this.sortBy() === 'latest') {
      list.sort(
        (a, b) =>
          new Date(b.paidAt).getTime() -
          new Date(a.paidAt).getTime()
      );
    } else if (this.sortBy() === 'amount-desc') {
      list.sort((a, b) => b.amount - a.amount);
    } else if (this.sortBy() === 'amount-asc') {
      list.sort((a, b) => a.amount - b.amount);
    }

    return list;
  });

  paginated = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.ceil(this.filtered().length / this.pageSize)
  );

  totalRevenue = computed(() =>
    this.paymentService.payments()
      .filter(p => p.status === 'Completed')
      .reduce((s, p) => s + p.amount, 0)
  );

  todayRevenue = computed(() => {
    const today = new Date().toDateString();
    return this.paymentService.payments()
      .filter(p =>
        p.status === 'Completed' &&
        new Date(p.paidAt).toDateString() === today
      )
      .reduce((s, p) => s + p.amount, 0);
  });

  monthlyRevenue = computed(() => {
    const now = new Date();
    return this.paymentService.payments()
      .filter(p => {
        const d = new Date(p.paidAt);
        return p.status === 'Completed' &&
               d.getMonth()     === now.getMonth() &&
               d.getFullYear()  === now.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0);
  });

  successCount = computed(() =>
    this.paymentService.payments()
      .filter(p => p.status === 'Completed').length
  );

  failedCount = computed(() =>
    this.paymentService.payments()
      .filter(p => p.status === 'Failed').length
  );

  // Monthly breakdown for chart
  monthlyData = computed(() => {
    const map: Record<string, number> = {};
    this.paymentService.payments()
      .filter(p => p.status === 'Completed')
      .forEach(p => {
        const d   = new Date(p.paidAt);
        const key = d.toLocaleString('default', {
          month: 'short', year: '2-digit'
        });
        map[key] = (map[key] ?? 0) + p.amount;
      });
    return Object.entries(map)
      .slice(-6)
      .map(([month, revenue]) => ({ month, revenue }));
  });

  maxRevenue = computed(() =>
    Math.max(...this.monthlyData().map(d => d.revenue), 1)
  );

  setPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
  }

  pageNumbers = computed(() => {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages(); i++) {
      pages.push(i);
    }
    return pages;
  });

  exportCsv(): void {
    const rows = [
      ['ID', 'User', 'Movie', 'Amount', 'Method',
       'Status', 'Date'],
      ...this.filtered().map(p => [
        p.id, p.userName, p.movieTitle,
        p.amount, p.method, p.status,
        this.formatDate(p.paidAt)
      ])
    ];
    const csv = rows
      .map(r => r.join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'payments.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.toastr.success('CSV exported!', 'Export');
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatCurrency(n: number): string {
    return '₹' + (n ?? 0).toLocaleString('en-IN');
  }

  statusClass(s: string): string {
    if (s === 'Completed') return 'pill-success';
    if (s === 'Failed')    return 'pill-danger';
    if (s === 'Pending')   return 'pill-warning';
    return 'pill-default';
  }

  logout(): void { this.auth.logout(); }
}