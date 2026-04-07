import {
  Component, OnInit, inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar';
import {
  CartService, CartItem
} from '../../../services/cart.service';
import { AuthService } from '../../../services/auth.service';
import { RentalService } from '../../../services/rental.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent implements OnInit {

  cartService   = inject(CartService);
  auth          = inject(AuthService);
  rentalService = inject(RentalService);
  router        = inject(Router);
  private toastr = inject(ToastrService);

  // ✅ STATES
  isLoading      = signal(false);
  isCheckingOut  = signal(false);
  removingId     = signal<number | null>(null);
  updatingId     = signal<number | null>(null);
  showSuccess    = signal(false);

  // Payment modal
  showPayModal   = signal(false);
  selectedMethod = signal<'upi' | 'card' | 'netbanking'>('upi');
  paymentSuccess = signal(false);
  payTxnId       = signal('');

  openPayModal(): void {
    if (this.cartService.cartItems().length === 0) {
      this.toastr.warning('Cart is empty');
      return;
    }
    this.paymentSuccess.set(false);
    this.payTxnId.set('');
    this.showPayModal.set(true);
  }

  closePayModal(): void {
    if (!this.paymentSuccess()) {
      this.showPayModal.set(false);
    }
  }

  private generateTxnId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'TXN';
    for (let i = 0; i < 9; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  confirmPayment(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;
    if (!userId || this.isCheckingOut()) return;

    this.isCheckingOut.set(true);

    const method = this.selectedMethod() === 'upi' ? 'UPI'
      : this.selectedMethod() === 'card' ? 'Card' : 'NetBanking';

    this.cartService.checkout(userId, method).subscribe({
      next: () => {
        this.isCheckingOut.set(false);
        this.payTxnId.set(this.generateTxnId());
        this.paymentSuccess.set(true);
        this.cartService.loadCart(userId);
        this.rentalService.loadMyRentals(userId);
      },
      error: (err: any) => {
        this.isCheckingOut.set(false);
        this.toastr.error(err?.error?.message ?? 'Payment failed');
      }
    });
  }

  goToRentals(): void {
    this.showPayModal.set(false);
    this.router.navigate(['/my-rentals']);
  }

  readonly PLACEHOLDER =
    'assets/images/placeholders/movie-placeholder.svg';

  // ✅ TOTAL AMOUNT
  totalAmount = computed(() =>
    Math.round(
      this.cartService.cartItems().reduce(
        (sum: number, c: CartItem) =>
          sum + c.rentalPrice * c.durationDays,
        0
      )
    )
  );

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;

    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.isLoading.set(true);

    this.cartService.loadCart(userId);
    this.rentalService.loadMyRentals(userId);

    // simulate loading end
    setTimeout(() => this.isLoading.set(false), 500);
  }

  // ✅ UPDATE DURATION
  updateDuration(item: CartItem, days: number): void {
    if (this.updatingId() === item.id) return;

    this.updatingId.set(item.id);

    this.cartService.updateDuration(item.id, days).subscribe({
      next: () => {
        const userId = this.auth.currentUser()?.userId ?? 0;
        this.cartService.loadCart(userId);
        this.updatingId.set(null);
      },
      error: (err: any) => {
        this.updatingId.set(null);
        this.toastr.error(
          err?.error?.message ?? 'Update failed.'
        );
      }
    });
  }

  // ✅ INCREASE / DECREASE
  increaseDuration(item: CartItem): void {
    if (item.durationDays < 30) {
      this.updateDuration(item, item.durationDays + 1);
    }
  }

  decreaseDuration(item: CartItem): void {
    if (item.durationDays > 1) {
      this.updateDuration(item, item.durationDays - 1);
    }
  }

  // ✅ REMOVE ITEM
  removeItem(item: CartItem): void {
    if (this.removingId() === item.id) return;

    this.removingId.set(item.id);

    this.cartService.removeFromCart(item.id).subscribe({
      next: () => {
        const userId = this.auth.currentUser()?.userId ?? 0;
        this.cartService.loadCart(userId);
        this.removingId.set(null);

        this.toastr.info(
          `"${item.movieTitle}" removed from cart`
        );
      },
      error: (err: any) => {
        this.removingId.set(null);
        this.toastr.error(
          err?.error?.message ?? 'Remove failed'
        );
      }
    });
  }

  // ✅ CLEAR CART
  clearCart(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;

    if (!userId) return;

    this.cartService.clearCart(userId).subscribe({
      next: () => {
        this.cartService.loadCart(userId);
        this.toastr.info('Cart cleared');
      },
      error: () => {
        this.toastr.error('Failed to clear cart');
      }
    });
  }

  // ✅ CHECKOUT
  checkout(): void {
    const userId = this.auth.currentUser()?.userId ?? 0;

    if (!userId || this.isCheckingOut()) return;

    if (this.cartService.cartItems().length === 0) {
      this.toastr.warning('Cart is empty');
      return;
    }

    this.isCheckingOut.set(true);

    this.cartService.checkout(userId).subscribe({
      next: () => {
        this.isCheckingOut.set(false);

        this.cartService.loadCart(userId);
        this.rentalService.loadMyRentals(userId);

        this.toastr.success('Checkout successful 🎉');
        this.router.navigate(['/my-rentals']);
      },
      error: (err: any) => {
        this.isCheckingOut.set(false);
        this.toastr.error(
          err?.error?.message ?? 'Checkout failed'
        );
      }
    });
  }

  poster(url?: string | null): string {
    return url ?? this.PLACEHOLDER;
  }
}