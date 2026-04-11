import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';
import { ChatbotComponent } from '../../user/chatbot/chatbot';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ChatbotComponent],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent implements OnInit {
  auth        = inject(AuthService);
  cartService = inject(CartService);

  menuOpen       = signal(false);
  showLogoutDrop = signal(false);
  isDark         = signal(true);
  chatOpen       = signal(false);

  ngOnInit(): void {
    const userId = this.auth.currentUser()?.userId;
    if (userId) {
      this.cartService.loadCart(userId);
    }
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      this.isDark.set(false);
      document.body.classList.add('light');
    }
  }

  toggleTheme(): void {
    const goLight = this.isDark();
    this.isDark.set(!goLight);
    if (goLight) {
      document.body.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }

  confirmLogout(): void {
    this.showLogoutDrop.set(false);
    this.auth.logout();
  }

  cancelLogout(): void {
    this.showLogoutDrop.set(false);
  }

}