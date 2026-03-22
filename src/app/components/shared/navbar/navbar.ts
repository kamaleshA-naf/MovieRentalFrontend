import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService }         from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { CartService }         from '../../../services/cart.service';

@Component({
  selector:  'app-navbar',
  standalone: true,
  imports:   [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl:    './navbar.css'
})
export class NavbarComponent implements OnInit {
  auth            = inject(AuthService);
  notificationSvc = inject(NotificationService);
  cartService     = inject(CartService);

  menuOpen  = signal(false);
  notifOpen = signal(false);

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId;
    if (userId) {
      this.notificationSvc.loadNotifications(userId);
      this.cartService.loadCart(userId);
    }
  }

  // ✅ Just calls auth.logout() — toast is inside auth.logout()
  logout(): void {
    this.auth.logout();
  }

  markRead(id: number): void {
    this.notificationSvc.markAsRead(id).subscribe({
      next: () => {
        const userId = this.auth.currentUser()?.userId;
        if (userId) this.notificationSvc.loadNotifications(userId);
      }
    });
  }

  markAllRead(): void {
    const unread = this.notificationSvc.notifications()
      .filter(n => !n.isRead);
    unread.forEach(n => {
      this.notificationSvc.markAsRead(n.id).subscribe();
    });
    setTimeout(() => {
      const userId = this.auth.currentUser()?.userId;
      if (userId) this.notificationSvc.loadNotifications(userId);
    }, 300);
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'Just now';
  }

  notifIcon(type: string): string {
    const icons: Record<string, string> = {
      RentalExpiry: 'clock', NewRelease: 'star',
      PaymentSuccess: 'check', ReturnReminder: 'bell'
    };
    return icons[type] ?? 'bell';
  }
}