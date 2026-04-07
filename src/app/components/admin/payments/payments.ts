import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PaymentService, PaymentSummary } from '../../../services/payment.service';
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

  searchQuery  = signal('');
  statusFilter = signal('all');
  methodFilter = signal('all');
  sortBy       = signal('latest');
  activeTab    = signal<'table' | 'charts'>('table');

  readonly PAGE_SIZE = 10;

  ngOnInit(): void {
    this.paymentService.loadPayments(1, this.PAGE_SIZE);
    this.paymentService.loadStats();
  }

  // Client-side filter + sort on the current page's data
  filtered = computed(() => {
    let list = [...this.paymentService.payments()].map(p => ({
      ...p,
      method: this.normalizeMethod(p.method)
    }));

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(p =>
        p.userName?.toLowerCase().includes(q) ||
        p.movieTitle?.toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    }

    if (this.statusFilter() !== 'all') {
      list = list.filter(p =>
        p.status?.toLowerCase() === this.statusFilter().toLowerCase()
      );
    }

    if (this.methodFilter() !== 'all') {
      list = list.filter(p =>
        p.method?.toLowerCase() === this.methodFilter().toLowerCase()
      );
    }

    if (this.sortBy() === 'latest') {
      list.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    } else if (this.sortBy() === 'amount-desc') {
      list.sort((a, b) => b.amount - a.amount);
    } else if (this.sortBy() === 'amount-asc') {
      list.sort((a, b) => a.amount - b.amount);
    }

    return list;
  });

  // Server-side pagination controls
  get currentPage(): number { return this.paymentService.currentPage(); }
  get totalPages():  number { return this.paymentService.totalPages(); }
  get totalCount():  number { return this.paymentService.totalCount(); }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.paymentService.loadPayments(page, this.PAGE_SIZE);
  }

  pageNumbers = computed(() => {
    const total = this.paymentService.totalPages();
    const cur   = this.paymentService.currentPage();
    const pages: number[] = [];
    // Show at most 7 page buttons with ellipsis logic
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push(-1); // ellipsis
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push(-1); // ellipsis
      pages.push(total);
    }
    return pages;
  });

  // Stats derived from current page (full stats come from loadStats)
  totalRevenue = computed(() =>
    this.paymentService.stats()?.totalRevenue ??
    this.paymentService.payments().filter(p => p.status === 'Completed').reduce((s, p) => s + p.amount, 0)
  );

  todayRevenue = computed(() => {
    const today = new Date().toDateString();
    return this.paymentService.payments()
      .filter(p => p.status === 'Completed' && new Date(p.paidAt).toDateString() === today)
      .reduce((s, p) => s + p.amount, 0);
  });

  monthlyRevenue = computed(() => {
    const now = new Date();
    return this.paymentService.payments()
      .filter(p => {
        const d = new Date(p.paidAt);
        return p.status === 'Completed' &&
               d.getMonth() === now.getMonth() &&
               d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0);
  });

  successCount = computed(() =>
    this.paymentService.stats()?.successCount ??
    this.paymentService.payments().filter(p => p.status === 'Completed').length
  );

  failedCount = computed(() =>
    this.paymentService.stats()?.failedCount ??
    this.paymentService.payments().filter(p => p.status === 'Failed').length
  );

  monthlyData = computed(() => {
    const map: Record<string, number> = {};
    this.paymentService.payments()
      .filter(p => p.status === 'Completed')
      .forEach(p => {
        const key = new Date(p.paidAt).toLocaleString('default', { month: 'short', year: '2-digit' });
        map[key] = (map[key] ?? 0) + p.amount;
      });
    return Object.entries(map).slice(-6).map(([month, revenue]) => ({ month, revenue }));
  });

  maxRevenue = computed(() => Math.max(...this.monthlyData().map(d => d.revenue), 1));

  exportCsv(): void {
    const rows = [
      ['ID', 'User', 'Movie', 'Amount', 'Method', 'Status', 'Date'],
      ...this.filtered().map(p => [p.id, p.userName, p.movieTitle, p.amount, p.method, p.status, this.formatDate(p.paidAt)])
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'payments.csv' });
    a.click();
    URL.revokeObjectURL(a.href);
    this.toastr.success('CSV exported!', 'Export');
  }

  formatDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatCurrency(n: number): string { return '₹' + (n ?? 0).toLocaleString('en-IN'); }

  statusClass(s: string): string {
    if (s === 'Completed') return 'pill-success';
    if (s === 'Failed')    return 'pill-danger';
    if (s === 'Pending')   return 'pill-warning';
    if (s === 'Refunded' || s === 'REFUNDED') return 'pill-refunded';
    return 'pill-default';
  }

  normalizeMethod(method: string): string {
    const m = (method ?? '').toLowerCase().trim();
    if (m.includes('upi'))  return 'UPI';
    if (m.includes('card')) return 'Card';
    if (m.includes('net'))  return 'NetBanking';
    if (m === 'online' || m === '') return 'UPI';
    return method ?? 'UPI';
  }

  methodLabel(method: string): string { return this.normalizeMethod(method); }

  methodClass(method: string): string {
    const m = this.normalizeMethod(method).toLowerCase();
    if (m === 'upi')        return 'method-upi';
    if (m === 'card')       return 'method-card';
    if (m === 'netbanking') return 'method-netbanking';
    return 'method-upi';
  }

  logout(): void { this.auth.logout(); }
}
